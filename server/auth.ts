import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import session from "express-session";
import type { Request, Response, NextFunction } from "express";
import type { DB } from "./db.js";
import type { User } from "../shared/types.js";
import type { Config } from "./config.js";
const scrypt = promisify(scryptCallback);
declare module "express-session" {
  interface SessionData {
    userId?: number;
    authVersion?: number;
    csrfToken?: string;
    oauth?: {
      state: string;
      verifier: string;
      nonce: string;
      expires: number;
      linkUserId?: number;
    };
  }
}
declare global {
  namespace Express {
    interface Request {
      user?: User | null;
    }
  }
}
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiFailure(status, code, message);
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${((await scrypt(password, salt, 64)) as Buffer).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) {
    await scrypt(password, "dummy-padding-salt", 64);
    return false;
  }
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function publicUser(user: any): User {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    is_staff: !!user.is_staff,
  };
}
export class DatabaseSessionStore extends session.Store {
  constructor(private db: DB) {
    super();
  }
  get(
    sid: string,
    callback: (err?: any, session?: session.SessionData | null) => void,
  ) {
    this.db("sessions")
      .where({ sid })
      .first()
      .then((row) => {
        if (!row || Number(row.expires) < Date.now())
          return callback(null, null);
        try {
          callback(null, JSON.parse(row.data));
        } catch (e) {
          callback(e);
        }
      }, callback);
  }
  set(sid: string, data: session.SessionData, callback?: (err?: any) => void) {
    const expires = data.cookie?.expires
      ? new Date(data.cookie.expires).valueOf()
      : Date.now() + 7 * 86400000;
    this.db("sessions")
      .insert({ sid, data: JSON.stringify(data), expires })
      .onConflict("sid")
      .merge()
      .then(() => callback?.(), callback);
  }
  destroy(sid: string, callback?: (err?: any) => void) {
    this.db("sessions")
      .where({ sid })
      .delete()
      .then(() => callback?.(), callback);
  }
  touch(
    sid: string,
    data: session.SessionData,
    callback?: (err?: any) => void,
  ) {
    const expires = data.cookie?.expires
      ? new Date(data.cookie.expires).valueOf()
      : Date.now() + 7 * 86400000;
    this.db("sessions")
      .where({ sid })
      .update({ expires })
      .then(() => callback?.(), callback);
  }
}
export function loadUser(db: DB) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.session.userId) {
        const user = await db("users")
          .where({ id: req.session.userId, is_active: true })
          .first();
        if (!user || user.auth_version !== req.session.authVersion) {
          delete req.session.userId;
          delete req.session.authVersion;
        } else req.user = publicUser(user);
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function ensureCsrf(req: Request) {
  return (req.session.csrfToken ||= token());
}
export function csrf(config: Config) {
  const allowed = new Set([config.origin, ...config.trustedOrigins]);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("Origin");
    if (origin && !allowed.has(origin))
      return next(
        new ApiFailure(403, "origin", "This request origin is not allowed."),
      );
    if (req.get("Sec-Fetch-Site") === "cross-site")
      return next(
        new ApiFailure(403, "origin", "Cross-site requests are not allowed."),
      );
    const actual = req.get("X-CSRF-Token") || "";
    const expected = req.session.csrfToken || "";
    if (
      !expected ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      return next(
        new ApiFailure(
          403,
          "csrf",
          "Your form session expired. Refresh and try again.",
        ),
      );
    next();
  };
}
export const requireUser = (
  req: Request,
  _res: Response,
  next: NextFunction,
) =>
  req.user
    ? next()
    : next(
        new ApiFailure(
          401,
          "authentication_required",
          "Please sign in to continue.",
        ),
      );
export const requireStaff = (
  req: Request,
  _res: Response,
  next: NextFunction,
) =>
  !req.user
    ? next(
        new ApiFailure(
          401,
          "authentication_required",
          "Please sign in to continue.",
        ),
      )
    : req.user.is_staff
      ? next()
      : next(
          new ApiFailure(
            403,
            "staff_required",
            "Administrator access is required.",
          ),
        );
export const saveSession = (req: Request) =>
  new Promise<void>((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
export async function rotateSession(req: Request, user?: any) {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  if (user) {
    req.session.userId = user.id;
    req.session.authVersion = user.auth_version;
    req.user = publicUser(user);
  } else req.user = null;
  ensureCsrf(req);
  await saveSession(req);
}
export async function sessionView(req: Request, db: DB, config: Config) {
  return {
    user: req.user || null,
    csrfToken: ensureCsrf(req),
    features: {
      google: !!(config.googleClientId && config.googleClientSecret),
      smtp: !!config.smtpUrl,
      ocr: false,
      website_extraction: true,
      preview: config.preview,
    },
    favorites: req.user
      ? (
          await db("favorites")
            .where({ user_id: req.user.id })
            .select("business_id")
        ).map((r) => r.business_id)
      : [],
  };
}
