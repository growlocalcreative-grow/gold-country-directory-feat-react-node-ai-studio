import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import session from "express-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import path from "node:path";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import type { Config } from "./config.js";
import { type DB, now, insertId } from "./db.js";
import {
  ApiFailure,
  fail,
  DatabaseSessionStore,
  loadUser,
  csrf,
  requireUser,
  requireStaff,
  sessionView,
  rotateSession,
  verifyPassword,
  hashPassword,
  token,
  digest,
  saveSession,
  publicUser,
} from "./auth.js";
import {
  categories,
  popular,
  businessViews,
  cleanReview,
  localId,
  uniqueSlug,
  exportPublic,
  importData,
} from "./domain.js";
import {
  businessSchema,
  signupSchema,
  email,
  passwordSchema,
  contactSchema,
  suggestionSchema,
  reviewSchema,
  claimSchema,
  parse,
} from "./validation.js";
import { MediaStorage } from "./storage.js";
import { resetEmail } from "./email.js";
import { importWebsite } from "./website.js";
const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
const param = (req: Request, name: string) => String(req.params[name] || "");
const findBusiness = async (db: DB, slug: string) => {
  const b = await db("businesses").where({ slug, status: "approved" }).first();
  if (!b) fail(404, "not_found", "Business not found.");
  return b;
};
export function createApp(db: DB, config: Config) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(!config.production ? ["'unsafe-inline'"] : []),
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: [
            "'self'",
            ...(!config.production ? ["ws:", "wss:"] : []),
          ],
          frameAncestors: [
            "'self'",
            ...(config.preview ? config.previewFrameAncestors : []),
          ],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.secureCookies ? [] : null,
        },
      },
      strictTransportSecurity: config.secureCookies ? undefined : false,
      crossOriginEmbedderPolicy: false,
      xFrameOptions:
        config.preview && config.previewFrameAncestors.length > 0
          ? false
          : { action: "sameorigin" },
    }),
  );
  if (config.preview)
    app.use((_req, res, next) => {
      res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      next();
    });
  app.get(
    "/healthz",
    asyncRoute(async (_req, res) => {
      await db("categories").first();
      res.json({
        status: "ok",
        runtime: "node",
        database: config.databaseUrl ? "postgresql" : "sqlite",
      });
    }),
  );
  app.get("/robots.txt", (_req, res) =>
    res
      .type("text/plain")
      .send(
        config.preview
          ? "User-agent: *\nDisallow: /\n"
          : "User-agent: *\nDisallow: /admin/\nDisallow: /account/\n",
      ),
  );
  app.use(
    "/static",
    express.static(path.join(config.root, "static"), {
      dotfiles: "deny",
      maxAge: config.production ? "7d" : 0,
    }),
  );
  const storage = new MediaStorage(config);
  app.get(
    "/media/businesses/:filename",
    asyncRoute(async (req, res) => {
      const key = `businesses/${param(req, "filename")}`;
      const data = await storage.read(key);
      res
        .set("Content-Security-Policy", "default-src 'none'")
        .set("Cache-Control", "public, max-age=31536000, immutable")
        .type("image/jpeg")
        .send(data);
    }),
  );
  app.use("/api", express.json({ limit: "12mb" }));
  app.use(
    "/api",
    session({
      name: "gcd.sid",
      secret: config.sessionSecret,
      store: new DatabaseSessionStore(db),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.secureCookies,
        sameSite: "lax",
        maxAge: 7 * 86400000,
        path: "/",
      },
    }),
  );
  app.use("/api", loadUser(db));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", csrf(config));
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "rate_limit",
        message: "Too many submissions. Please try again later.",
      },
    },
    skip: (req) => ["GET", "HEAD"].includes(req.method),
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "rate_limit",
        message: "Too many authentication attempts. Please try again later.",
      },
    },
  });
  app.use("/api", limit);
  app.get(
    "/api/session",
    asyncRoute(async (req, res) =>
      res.json(await sessionView(req, db, config)),
    ),
  );
  app.post(
    "/api/auth/signup",
    authLimit,
    asyncRoute(async (req, res) => {
      const data = parse(signupSchema, req.body);
      if (await db("users").where({ email: data.email }).first())
        fail(
          409,
          "email_exists",
          "An account with this email already exists. Sign in or reset your password.",
        );
      const id = await insertId(db, "users", {
        email: data.email,
        password_hash: await hashPassword(data.password),
        first_name: data.first_name,
        last_name: data.last_name,
        created_at: now(),
      });
      const user = await db("users").where({ id }).first();
      await rotateSession(req, user);
      res.status(201).json(await sessionView(req, db, config));
    }),
  );
  app.post(
    "/api/auth/login",
    authLimit,
    asyncRoute(async (req, res) => {
      const data = parse(
        z.object({ email, password: z.string().max(128) }),
        req.body,
      );
      const user = await db("users").where({ email: data.email }).first();
      if (
        !(await verifyPassword(data.password, user?.password_hash || null)) ||
        !user?.is_active
      )
        fail(400, "invalid_credentials", "Email or password is incorrect.");
      await rotateSession(req, user);
      res.json(await sessionView(req, db, config));
    }),
  );
  app.post(
    "/api/auth/logout",
    asyncRoute(async (req, res) => {
      await rotateSession(req);
      res.json(await sessionView(req, db, config));
    }),
  );
  app.post(
    "/api/auth/password-reset",
    authLimit,
    asyncRoute(async (req, res) => {
      const data = parse(z.object({ email }), req.body);
      const user = await db("users")
        .where({ email: data.email, is_active: true })
        .first();
      if (user) {
        const raw = token();
        await db("password_resets").where({ user_id: user.id }).delete();
        await db("password_resets").insert({
          token_hash: digest(raw),
          user_id: user.id,
          expires: Date.now() + 3600000,
        });
        await resetEmail(config, user.email, raw);
      }
      res.json({
        message:
          "If an account exists, password reset instructions have been sent to its configured email delivery channel.",
      });
    }),
  );
  app.post(
    "/api/auth/password-reset/confirm",
    authLimit,
    asyncRoute(async (req, res) => {
      const data = parse(passwordSchema, req.body);
      const raw = parse(
        z.object({ token: z.string().min(20).max(256) }),
        req.body,
      ).token;
      const password_hash = await hashPassword(data.password);
      await db.transaction(async (trx) => {
        const reset = await trx("password_resets")
          .where({ token_hash: digest(raw), used: false })
          .first();
        if (!reset || Number(reset.expires) < Date.now())
          fail(
            400,
            "invalid_token",
            "This password reset link is invalid or expired.",
          );
        const changed = await trx("password_resets")
          .where({ token_hash: digest(raw), used: false })
          .update({ used: true });
        if (!changed)
          fail(
            400,
            "invalid_token",
            "This password reset link has already been used.",
          );
        await trx("users")
          .where({ id: reset.user_id })
          .update({ password_hash })
          .increment("auth_version", 1);
      });
      await rotateSession(req);
      res.json({
        ...(await sessionView(req, db, config)),
        message:
          "Your password has been reset. Sign in with your new password.",
      });
    }),
  );
  app.post(
    "/api/auth/password-change",
    requireUser,
    authLimit,
    asyncRoute(async (req, res) => {
      const data = parse(passwordSchema, req.body);
      const current = parse(
        z.object({ current_password: z.string().max(128) }),
        req.body,
      ).current_password;
      const user = await db("users").where({ id: req.user!.id }).first();
      if (!(await verifyPassword(current, user.password_hash)))
        fail(400, "invalid_password", "Your current password is incorrect.");
      await db("users")
        .where({ id: user.id })
        .update({ password_hash: await hashPassword(data.password) })
        .increment("auth_version", 1);
      await rotateSession(
        req,
        await db("users").where({ id: user.id }).first(),
      );
      res.json(await sessionView(req, db, config));
    }),
  );
  const oauth = () =>
    new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      `${config.origin}/api/auth/google/callback`,
    );
  app.post(
    "/api/auth/google/start",
    authLimit,
    asyncRoute(async (req, res) => {
      if (!config.googleClientId || !config.googleClientSecret)
        fail(
          503,
          "google_unconfigured",
          "Google sign-in is not configured on this host. Email sign-in remains available.",
        );
      const link = req.body?.link === true;
      if (link && !req.user)
        fail(
          401,
          "authentication_required",
          "Sign in before linking a Google account.",
        );
      const state = token(),
        verifier = token() + token(),
        nonce = token();
      req.session.oauth = {
        state,
        verifier,
        nonce,
        expires: Date.now() + 10 * 60000,
        ...(link ? { linkUserId: req.user!.id } : {}),
      };
      await saveSession(req);
      const url = oauth().generateAuthUrl({
        access_type: "online",
        scope: ["openid", "email", "profile"],
        state,
        code_challenge: digestBase64(verifier),
        code_challenge_method: "S256" as any,
        prompt: "select_account",
        nonce,
      } as any);
      res.json({ url });
    }),
  );
  app.get(
    "/api/auth/google/callback",
    asyncRoute(async (req, res) => {
      if (!config.googleClientId || !config.googleClientSecret)
        fail(503, "google_unconfigured", "Google sign-in is not configured.");
      const pending = req.session.oauth;
      delete req.session.oauth;
      await saveSession(req);
      if (
        !pending ||
        pending.expires < Date.now() ||
        typeof req.query.state !== "string" ||
        req.query.state !== pending.state ||
        typeof req.query.code !== "string"
      )
        fail(
          400,
          "oauth_state",
          "Google sign-in could not be verified. Start again from the sign-in page.",
        );
      if (pending.linkUserId && req.user?.id !== pending.linkUserId)
        fail(
          403,
          "oauth_session",
          "Sign in again before linking your Google account.",
        );
      const client = oauth();
      const result = await client.getToken({
        code: req.query.code,
        codeVerifier: pending.verifier,
      });
      if (!result.tokens.id_token)
        fail(
          400,
          "oauth_token",
          "Google did not return a valid identity token.",
        );
      const ticket = await client.verifyIdToken({
        idToken: result.tokens.id_token!,
        audience: config.googleClientId,
      });
      const identity = ticket.getPayload();
      if (
        !identity?.sub ||
        !identity.email ||
        !identity.email_verified ||
        (identity as any).nonce !== pending.nonce
      )
        fail(400, "oauth_identity", "Google identity could not be verified.");
      const linked = await db("oauth_accounts")
        .where({ provider: "google", subject: identity.sub })
        .first();
      let user: any;
      if (linked) {
        if (pending.linkUserId && linked.user_id !== pending.linkUserId)
          fail(
            409,
            "oauth_linked",
            "That Google account is already linked to another account.",
          );
        user = await db("users")
          .where({ id: linked.user_id, is_active: true })
          .first();
        if (!user) fail(403, "inactive_account", "This account is inactive.");
      } else {
        const existing = await db("users")
          .where({ email: identity.email.toLowerCase() })
          .first();
        if (pending.linkUserId) {
          user = await db("users")
            .where({ id: pending.linkUserId, is_active: true })
            .first();
          if (!user) fail(403, "inactive_account", "This account is inactive.");
        } else if (existing) {
          fail(
            409,
            "account_link_required",
            "An account already uses this email. Sign in with its password, then explicitly link Google from your account.",
          );
        } else {
          const id = await insertId(db, "users", {
            email: identity.email.toLowerCase(),
            first_name: identity.given_name || "",
            last_name: identity.family_name || "",
            created_at: now(),
          });
          user = await db("users").where({ id }).first();
        }
        await db("oauth_accounts").insert({
          provider: "google",
          subject: identity.sub,
          user_id: user.id,
        });
      }
      await rotateSession(req, user);
      res.redirect("/account/");
    }),
  );
  app.get(
    "/api/categories",
    asyncRoute(async (_req, res) => {
      const all = await categories(db);
      res.json({ categories: all, popular_categories: popular(all) });
    }),
  );
  app.get(
    "/api/home",
    asyncRoute(async (req, res) => {
      const all = await businessViews(db, req.user, (q) =>
        q.where({ status: "approved" }),
      );
      const cats = await categories(db);
      const reviews = (
        await db("reviews")
          .where({ status: "approved" })
          .orderBy("created_at", "desc")
      )
        .filter((r) => all.some((b) => b.id === r.business_id))
        .slice(0, 6)
        .map((r) => ({
          ...cleanReview(r),
          business: all.find((b) => b.id === r.business_id),
        }));
      res.json({
        stats: { businesses: all.length, categories: cats.length },
        categories: cats,
        popular_categories: popular(cats),
        recent_businesses: [...all]
          .sort(
            (a, b) =>
              Number(b.is_premium) - Number(a.is_premium) ||
              b.created_at.localeCompare(a.created_at),
          )
          .slice(0, 12),
        featured_businesses: all
          .filter((b) => b.is_featured || b.is_premium)
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 12),
        recent_reviews: reviews,
      });
    }),
  );
  const directory = async (req: Request, res: Response, favorites = false) => {
    const all = await businessViews(db, req.user, (q) =>
      q.where({ status: "approved" }),
    );
    let filtered = favorites ? all.filter((b) => b.is_favorite) : all;
    const search = String(req.query.q || "")
        .trim()
        .slice(0, 200)
        .toLowerCase(),
      category = String(req.query.category || "").slice(0, 150),
      location = String(req.query.location || "")
        .slice(0, 500)
        .toLowerCase();
    if (search)
      filtered = filtered.filter((b) =>
        [
          b.name,
          b.description,
          b.category.name,
          b.city,
          b.address,
          b.address_street,
          b.contact_person,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search),
      );
    if (category)
      filtered = filtered.filter(
        (b) => b.category.slug === category || b.category.name === category,
      );
    if (location)
      filtered = filtered.filter((b) =>
        b.city.toLowerCase().includes(location),
      );
    const sort = String(req.query.sort || "name");
    filtered.sort((a, b) =>
      ["newest", "recent"].includes(sort)
        ? b.created_at.localeCompare(a.created_at) ||
          a.name.localeCompare(b.name)
        : ["rating", "highest-rated"].includes(sort)
          ? (b.average_rating || 0) - (a.average_rating || 0) ||
            a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
    );
    const size =
        req.query.page_size === "all"
          ? Math.max(1, filtered.length)
          : Math.min(100, Math.max(1, Number(req.query.page_size) || 24)),
      pages = Math.max(1, Math.ceil(filtered.length / size)),
      page = Math.min(
        pages,
        Math.max(1, Math.floor(Number(req.query.page) || 1)),
      );
    const cats = await categories(db);
    const groups = cats
      .map((c) => ({
        name: c.name,
        category: c,
        businesses: filtered.filter((b) => b.category_id === c.id),
        count: filtered.filter((b) => b.category_id === c.id).length,
      }))
      .filter((g) => g.count)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      businesses: filtered.slice((page - 1) * size, page * size),
      categories: cats,
      popular_categories: popular(cats),
      locations: [...new Set(all.map((b) => b.city).filter(Boolean))].sort(),
      total_count: filtered.length,
      business_count: all.length,
      page,
      pages,
      page_size: size,
      category_groups: groups,
    });
  };
  app.get(
    "/api/businesses",
    asyncRoute((req, res) => directory(req, res)),
  );
  app.get(
    "/api/favorites",
    requireUser,
    asyncRoute((req, res) => directory(req, res, true)),
  );
  app.get(
    "/api/businesses/by-source/:sourceId",
    asyncRoute(async (req, res) => {
      const rows = await businessViews(db, req.user, (q) =>
        q.where({ source_id: param(req, "sourceId"), status: "approved" }),
      );
      if (!rows.length) fail(404, "not_found", "Business not found.");
      res.json({ business: rows[0] });
    }),
  );
  app.get(
    "/api/businesses/:slug",
    asyncRoute(async (req, res) => {
      const rows = await businessViews(db, req.user, (q) =>
        q.where({ slug: param(req, "slug"), status: "approved" }),
      );
      if (!rows.length) fail(404, "not_found", "Business not found.");
      const business = rows[0];
      const reviews = (
        await db("reviews")
          .where({ business_id: business.id, status: "approved" })
          .orderBy("created_at", "desc")
      ).map(cleanReview);
      const related = await businessViews(db, req.user, (q) =>
        q
          .where({ status: "approved", category_id: business.category_id })
          .whereNot({ id: business.id })
          .orderBy("name")
          .limit(3),
      );
      res.json({
        business,
        reviews,
        related_businesses: related,
        is_favorite: business.is_favorite,
        can_edit: business.can_edit,
      });
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
  });
  app.post(
    "/api/uploads",
    upload.single("image"),
    asyncRoute(async (req, res) => {
      if (!req.file) fail(400, "invalid_image", "Please choose an image.");
      const saved = await storage.write(req.file!.buffer);
      await db("uploads").insert({
        key: saved.key,
        session_hash: digest(req.sessionID),
        user_id: req.user?.id || null,
        created_at: now(),
      });
      res.status(201).json(saved);
    }),
  );
  const businessInput = async (req: Request) => {
    const data = parse(businessSchema, req.body);
    if (!(await db("categories").where({ id: data.category_id }).first()))
      throw new ApiFailure(400, "validation", "Choose an existing category.", {
        category_id: "Choose an existing category.",
      });
    if (data.image) {
      const upload = await db("uploads").where({ key: data.image }).first();
      if (
        !upload ||
        (upload.session_hash !== digest(req.sessionID) &&
          (!req.user || upload.user_id !== req.user.id))
      )
        fail(
          403,
          "invalid_upload",
          "This uploaded image belongs to another session.",
        );
    }
    const { confirm_separate, ...fields } = data;
    const address = [
      `${fields.address_street} ${fields.address_unit}`.trim(),
      fields.city,
      `${fields.address_state} ${fields.address_zip}`.trim(),
    ]
      .filter(Boolean)
      .join(", ");
    return { data: fields, confirm_separate, address };
  };
  app.post(
    "/api/businesses",
    asyncRoute(async (req, res) => {
      const input = await businessInput(req);
      const normPhone = (s: string) =>
        s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      const normSite = (s: string) =>
        s
          .toLowerCase()
          .replace(/^https?:\/\/(www\.)?/, "")
          .replace(/\/$/, "");
      if (!input.confirm_separate) {
        const all = await businessViews(db, req.user, (q) =>
          q.where({ status: "approved" }),
        );
        const duplicates = all
          .filter(
            (b) =>
              (input.data.phones &&
                normPhone(b.phones) === normPhone(input.data.phones)) ||
              (input.data.email &&
                b.email.toLowerCase() === input.data.email) ||
              (input.data.website &&
                normSite(b.website) === normSite(input.data.website)),
          )
          .slice(0, 10);
        if (duplicates.length) {
          res.status(409).json({
            error: {
              code: "possible_duplicates",
              message:
                "Possible matching listings found. Confirm this is a separate business to continue.",
            },
            duplicates,
          });
          return;
        }
      }
      const source_id = localId();
      const id = await insertId(db, "businesses", {
        ...input.data,
        address: input.address,
        source_id,
        slug: await uniqueSlug(db, "businesses", input.data.name, source_id),
        status: "pending",
        submitted_by: req.user?.id || null,
        created_at: now(),
        updated_at: now(),
      });
      res.status(201).json({
        business: (
          await businessViews(db, req.user, (q) => q.where({ id }))
        )[0],
        message:
          "Your business has been submitted for review. It will appear after approval.",
      });
    }),
  );
  app.get(
    "/api/account",
    requireUser,
    asyncRoute(async (req, res) => {
      const user = req.user!;
      const businesses = await businessViews(db, user, (q) =>
        q.where("owner_id", user.id).orWhere("submitted_by", user.id),
      );
      const all = await businessViews(db, user);
      const withBusiness = (r: any) => ({
        ...r,
        business: all.find((b) => b.id === r.business_id),
      });
      res.json({
        businesses,
        pending_claims: (
          await db("claims")
            .where({ user_id: user.id })
            .orderBy("created_at", "desc")
        ).map(withBusiness),
        favorites: all.filter((b) => b.status === "approved" && b.is_favorite),
        my_reviews: (
          await db("reviews")
            .where({ user_id: user.id })
            .orderBy("created_at", "desc")
        ).map((r) => withBusiness(cleanReview(r))),
        submissions: (
          await db("suggestions")
            .where({ user_id: user.id })
            .orderBy("created_at", "desc")
        ).map(withBusiness),
      });
    }),
  );
  const editable = async (req: Request) => {
    const b = await db("businesses")
      .where({ id: Number(param(req, "id")) || -1 })
      .first();
    if (
      !b ||
      !(
        req.user!.is_staff ||
        b.owner_id === req.user!.id ||
        (b.submitted_by === req.user!.id && b.status === "pending")
      )
    )
      fail(404, "not_found", "Editable business not found.");
    return b;
  };
  app.get(
    "/api/account/businesses/:id",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = await editable(req);
      res.json({
        business: (
          await businessViews(db, req.user, (q) => q.where({ id: b.id }))
        )[0],
      });
    }),
  );
  app.patch(
    "/api/account/businesses/:id",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = await editable(req);
      const input = await businessInput(req);
      await db("businesses")
        .where({ id: b.id })
        .update({
          ...input.data,
          address: input.address,
          status: req.user!.is_staff ? b.status : "pending",
          updated_at: now(),
        });
      res.json({
        business: (
          await businessViews(db, req.user, (q) => q.where({ id: b.id }))
        )[0],
        message: req.user!.is_staff
          ? "Business updated."
          : "Your changes were saved and submitted for review.",
      });
    }),
  );
  app.post(
    "/api/businesses/:slug/favorite",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = await findBusiness(db, param(req, "slug"));
      const existing = await db("favorites")
        .where({ business_id: b.id, user_id: req.user!.id })
        .first();
      if (existing) await db("favorites").where({ id: existing.id }).delete();
      else
        await db("favorites")
          .insert({
            business_id: b.id,
            user_id: req.user!.id,
            created_at: now(),
          })
          .onConflict(["business_id", "user_id"])
          .ignore();
      res.json({ favorite: !existing });
    }),
  );
  app.post(
    "/api/businesses/:slug/reviews",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = await findBusiness(db, param(req, "slug"));
      if (b.owner_id === req.user!.id)
        fail(
          403,
          "owner_review",
          "Business owners cannot review their own listing.",
        );
      const data = parse(reviewSchema, req.body);
      const existing = await db("reviews")
        .where({ business_id: b.id, user_id: req.user!.id })
        .first();
      const id = existing
        ? existing.id
        : await insertId(db, "reviews", {
            ...data,
            business_id: b.id,
            user_id: req.user!.id,
            source_id: localId(),
            status: "pending",
            created_at: now(),
            updated_at: now(),
          });
      if (existing)
        await db("reviews")
          .where({ id })
          .update({ ...data, status: "pending", updated_at: now() });
      res.status(existing ? 200 : 201).json({
        review: cleanReview(await db("reviews").where({ id }).first()),
        message: "Your review was submitted for moderation.",
      });
    }),
  );
  app.post(
    "/api/businesses/:slug/claims",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = await findBusiness(db, param(req, "slug"));
      if (b.owner_id)
        fail(
          409,
          "already_owned",
          "This listing already has a verified owner. Contact the directory for help.",
        );
      const data = parse(claimSchema, req.body);
      if (
        await db("claims")
          .where({ business_id: b.id, user_id: req.user!.id })
          .first()
      )
        fail(409, "claim_exists", "Your claim is already on file.");
      const id = await insertId(db, "claims", {
        ...data,
        business_id: b.id,
        user_id: req.user!.id,
        created_at: now(),
      });
      res.status(201).json({
        claim: await db("claims").where({ id }).first(),
        message:
          "Your claim was submitted. An administrator must independently verify ownership before granting access.",
      });
    }),
  );
  app.post(
    "/api/businesses/:slug/suggestions",
    asyncRoute(async (req, res) => {
      const b = await findBusiness(db, param(req, "slug"));
      const data = parse(
        suggestionSchema.extend({ kind: z.enum(["edit", "remove", "merge"]) }),
        req.body,
      );
      const { company_website, ...fields } = data;
      const id = await insertId(db, "suggestions", {
        ...fields,
        business_id: b.id,
        user_id: req.user?.id || null,
        created_at: now(),
      });
      res.status(201).json({
        id,
        message: "Your request has been saved for administrator review.",
      });
    }),
  );
  app.post(
    "/api/suggestions/url",
    asyncRoute(async (req, res) => {
      const data = parse(
        suggestionSchema.extend({
          source_url: z
            .string()
            .url()
            .max(1500)
            .refine((s) => {
              const u = new URL(s);
              return (
                ["http:", "https:"].includes(u.protocol) &&
                !u.username &&
                !u.password
              );
            }, "Use a public HTTP or HTTPS URL."),
        }),
        req.body,
      );
      const { company_website, ...fields } = data;
      const id = await insertId(db, "suggestions", {
        ...fields,
        kind: "url",
        user_id: req.user?.id || null,
        created_at: now(),
      });
      res.status(201).json({
        id,
        message:
          "Your website was submitted for review. No listing is published until an administrator verifies it.",
      });
    }),
  );
  app.post(
    "/api/contact",
    asyncRoute(async (req, res) => {
      const { company_website, ...data } = parse(contactSchema, req.body);
      const id = await insertId(db, "contacts", { ...data, created_at: now() });
      res.status(201).json({
        id,
        message: "Thank you for reaching out. Your message has been received.",
      });
    }),
  );
  app.post("/api/scan-card", (_req, _res, next) =>
    next(
      new ApiFailure(
        503,
        "ocr_unavailable",
        "Card recognition is not configured. Please use the manual form; no external OCR service is called.",
      ),
    ),
  );
  app.post(
    "/api/account/extract-url",
    requireStaff,
    asyncRoute(async (req, res) => {
      const data = parse(
        z.object({ source_url: z.string().url().max(1500) }),
        req.body,
      );
      try {
        res.json({
          draft: await importWebsite(data.source_url),
          message:
            "Review and correct every field, and select a category before submitting. Nothing has been published.",
        });
      } catch (e) {
        if (e instanceof ApiFailure) throw e;
        throw new ApiFailure(
          400,
          "fetch_failed",
          "This website could not be read. Enter the details manually.",
        );
      }
    }),
  );
  app.get(
    "/api/admin",
    requireStaff,
    asyncRoute(async (req, res) => {
      const businesses = await businessViews(db, req.user);
      const users = (await db("users")).map(publicUser);
      const withBusiness = (r: any) => ({
        ...r,
        business: businesses.find((b) => b.id === r.business_id),
        user: users.find((u) => u.id === r.user_id),
      });
      const claims = (await db("claims").orderBy("created_at", "desc")).map(
          withBusiness,
        ),
        reviews = (await db("reviews").orderBy("created_at", "desc")).map((r) =>
          withBusiness(cleanReview(r)),
        ),
        suggestions = (
          await db("suggestions").orderBy("created_at", "desc")
        ).map(withBusiness),
        contacts = (await db("contacts").orderBy("created_at", "desc")).map(
          (r) => ({ ...r, resolved: !!r.resolved }),
        );
      res.json({
        businesses,
        claims,
        reviews,
        suggestions,
        contacts,
        users,
        stats: {
          businesses: businesses.filter((b) => b.status === "pending").length,
          claims: claims.filter((r) => r.status === "pending").length,
          reviews: reviews.filter((r) => r.status === "pending").length,
          suggestions: suggestions.filter((r) => r.status === "pending").length,
          contacts: contacts.filter((r) => !r.resolved).length,
        },
      });
    }),
  );
  app.post(
    "/api/admin/:kind/:id/moderate",
    requireStaff,
    asyncRoute(async (req, res) => {
      const kind = param(req, "kind");
      if (
        ![
          "businesses",
          "reviews",
          "claims",
          "suggestions",
          "contacts",
        ].includes(kind)
      )
        fail(404, "not_found", "Queue not found.");
      const data = parse(
        z.object({
          status: z.enum(["approved", "rejected"]).optional(),
          resolved: z.boolean().optional(),
          admin_notes: z.string().max(10000).optional(),
          ownership_verified: z.boolean().optional(),
        }),
        req.body,
      );
      const id = Number(param(req, "id")) || -1;
      await db.transaction(async (trx) => {
        let row = await trx(kind).where({ id }).first();
        if (!row) fail(404, "not_found", "Record not found.");
        if (kind === "contacts") {
          if (data.resolved === undefined)
            fail(400, "validation", "Choose whether this message is resolved.");
          await trx(kind)
            .where({ id })
            .update({
              resolved: data.resolved,
              ...(data.admin_notes !== undefined
                ? { admin_notes: data.admin_notes }
                : {}),
            });
        } else {
          if (!data.status)
            fail(400, "validation", "Choose approved or rejected.");
          if (kind === "claims") {
            if (row.status !== "pending")
              fail(409, "already_reviewed", "This claim was already reviewed.");
            if (data.status === "approved") {
              if (data.ownership_verified !== true)
                fail(
                  400,
                  "verification_required",
                  "Confirm that you independently verified ownership before approval.",
                );
              const changed = await trx("businesses")
                .where({ id: row.business_id })
                .andWhere((q) =>
                  q.whereNull("owner_id").orWhere("owner_id", row.user_id),
                )
                .update({ owner_id: row.user_id, updated_at: now() });
              if (!changed)
                fail(
                  409,
                  "ownership_conflict",
                  "This listing already has another owner. Resolve the conflict manually.",
                );
            }
            const reviewed = await trx(kind)
              .where({ id, status: "pending" })
              .update({
                status: data.status,
                reviewed_at: now(),
                reviewed_by: req.user!.id,
                ...(data.admin_notes !== undefined
                  ? { admin_notes: data.admin_notes }
                  : {}),
              });
            if (!reviewed)
              fail(409, "already_reviewed", "This claim was already reviewed.");
          } else
            await trx(kind)
              .where({ id })
              .update({
                status: data.status,
                ...(["businesses", "reviews"].includes(kind)
                  ? { updated_at: now() }
                  : {}),
                ...(data.admin_notes !== undefined && kind === "suggestions"
                  ? { admin_notes: data.admin_notes }
                  : {}),
                ...(data.admin_notes !== undefined && kind === "businesses"
                  ? { moderation_notes: data.admin_notes }
                  : {}),
              });
        }
        await trx("audit_events").insert({
          actor_id: req.user!.id,
          action: "moderate",
          kind,
          record_id: id,
          details: JSON.stringify(data),
          created_at: now(),
        });
      });
      res.json({
        message:
          kind === "suggestions"
            ? "Request reviewed. Listing changes must be applied explicitly; review status does not alter or delete a listing."
            : "Moderation decision saved.",
      });
    }),
  );
  app.get(
    "/api/admin/export",
    requireStaff,
    asyncRoute(async (_req, res) => {
      res
        .attachment("gold-country-directory-public.json")
        .json(await exportPublic(db));
    }),
  );
  app.post(
    "/api/admin/import",
    requireStaff,
    asyncRoute(async (req, res) => {
      if (!req.body?.payload)
        fail(
          400,
          "validation",
          "Provide a public directory export in payload.",
        );
      try {
        const result = await importData(db, req.body.payload, {
          updateExisting: req.body.update_existing === true,
          dryRun: req.body.dry_run === true,
        });
        await db("audit_events").insert({
          actor_id: req.user!.id,
          action: "import",
          kind: "directory",
          details: JSON.stringify(result),
          created_at: now(),
        });
        res.json({
          result,
          message: result.dry_run
            ? "Import validated without changes."
            : "Import completed. Account ownership and private data are never imported.",
        });
      } catch (e) {
        throw new ApiFailure(
          400,
          "invalid_import",
          e instanceof Error ? e.message : "Import failed.",
        );
      }
    }),
  );
  app.use("/api", (_req, _res, next) =>
    next(new ApiFailure(404, "not_found", "API route not found.")),
  );
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiFailure)
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      });
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        error: {
          code: "invalid_image",
          message: "Upload one image of no more than 5 MB.",
        },
      });
    if (error?.type === "entity.too.large")
      return res.status(413).json({
        error: { code: "too_large", message: "This request is too large." },
      });
    if (error instanceof SyntaxError && "body" in error)
      return res.status(400).json({
        error: { code: "invalid_json", message: "Invalid JSON request." },
      });
    if (error?.code === "23505" || error?.code === "SQLITE_CONSTRAINT_UNIQUE")
      return res.status(409).json({
        error: {
          code: "conflict",
          message: "This record already exists. Refresh and try again.",
        },
      });
    console.error(
      "Request failed:",
      error?.name || "Error",
      error?.code || "unexpected",
    );
    return res.status(500).json({
      error: {
        code: "server_error",
        message: "The request could not be completed. Please try again.",
      },
    });
  });
  return app;
}
function digestBase64(s: string) {
  return Buffer.from(digest(s), "hex").toString("base64url");
}
