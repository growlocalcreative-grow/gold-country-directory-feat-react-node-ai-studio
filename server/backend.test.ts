import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import supertest from "supertest";
import sharp from "sharp";
import { getConfig } from "./config.js";
import { openDatabase, migrate, now } from "./db.js";
import { createApp } from "./app.js";
import {
  importData,
  exportPublic,
  seed,
  applyClientUpdates,
} from "./domain.js";
import { hashPassword, DatabaseSessionStore } from "./auth.js";
import { cleanImage } from "./storage.js";
import {
  extractMetadata,
  publicAddress,
  validateWebsiteUrl,
} from "./website.js";
const sample = {
  Category: [
    {
      id: "cat-one",
      name: "Roofers ",
      is_popular: true,
      created_by: "never-import-creator@example.test",
    },
  ],
  Businesses: [
    {
      id: "one",
      business_name: "One Roofer ",
      category: "Roofers ",
      phones: "(530) 555-0100",
      email: "public@example.test",
      status: "approved",
      claimed_by: "never-import@example.test",
      claim_phone: "never-import-claim-phone",
      owner_id: 987,
      account: { email: "never-import-account@example.test" },
      claim_status: "approved",
    },
    {
      id: "two",
      business_name: "Second Roofer",
      category: "Roofers ",
      status: "approved",
    },
    {
      id: "pending",
      business_name: "Hidden Roofer",
      category: "Roofers ",
      status: "pending",
    },
  ],
  Reviews: [
    {
      id: "original-review",
      business_id: "one",
      reviewer_name: "Neighbor",
      rating: 5,
      comment: "Helpful",
      status: "approved",
      reviewer_email: "never-publish@example.test",
    },
  ],
};
async function fixture() {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "gcd-node-test-"));
  const config = getConfig({
    production: false,
    root: process.cwd(),
    origin: "http://localhost:3000",
    sessionSecret: "a-test-session-secret-with-more-than-32-characters",
    sqlitePath: path.join(folder, "db.sqlite"),
    mediaRoot: path.join(folder, "media"),
    emailRoot: path.join(folder, "emails"),
    databaseUrl: "",
    smtpUrl: "",
    googleClientId: "",
    googleClientSecret: "",
    storageBucket: "",
    autoMigrate: false,
    autoSeed: false,
  });
  const db = openDatabase(config);
  await migrate(db);
  await importData(db, sample);
  const app = createApp(db, config);
  let counter = 0;
  const actor = async (staff = false) => {
    const a = supertest.agent(app);
    let csrf = (await a.get("/api/session")).body.csrfToken;
    const email = `person-${++counter}@example.test`;
    const response = await a
      .post("/api/auth/signup")
      .set("X-CSRF-Token", csrf)
      .send({
        email,
        password: "a-strong-test-password-42",
        first_name: "Pat",
      });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    csrf = response.body.csrfToken;
    const id = response.body.user.id;
    if (staff) await db("users").where({ id }).update({ is_staff: true });
    return {
      a,
      id,
      email,
      get csrf() {
        return csrf;
      },
      set csrf(value: string) {
        csrf = value;
      },
      post: (url: string, data: any = {}) =>
        a.post(url).set("X-CSRF-Token", csrf).send(data),
      patch: (url: string, data: any = {}) =>
        a.patch(url).set("X-CSRF-Token", csrf).send(data),
    };
  };
  return {
    db,
    config,
    app,
    folder,
    actor,
    close: async () => {
      await db.destroy();
      await fs.rm(folder, { recursive: true, force: true });
    },
  };
}

test("public source import remains exact, idempotent, privacy-safe, and round-trippable", async (t) => {
  const f = await fixture();
  try {
    await t.test(
      "retains trailing whitespace and historical verified display without an owner",
      async () => {
        const one = await f
          .db("businesses")
          .where({ source_id: "one" })
          .first();
        assert.equal(one.name, "One Roofer ");
        assert.equal(one.owner_id, null);
        assert.equal((await f.db("categories").first()).name, "Roofers ");
      },
    );
    await t.test(
      "snapshots exclude private metadata while preserving exact public source values",
      async () => {
        const category = JSON.parse(
          (await f.db("categories").first()).source_data,
        );
        assert.deepEqual(category, {
          id: "cat-one",
          name: "Roofers ",
          is_popular: true,
        });
        const business = JSON.parse(
          (await f.db("businesses").where({ source_id: "one" }).first())
            .source_data,
        );
        const {
          claimed_by,
          claim_phone,
          owner_id,
          account,
          ...publicBusiness
        } = sample.Businesses[0];
        assert.deepEqual(business, publicBusiness);
        const review = JSON.parse((await f.db("reviews").first()).source_data);
        const { reviewer_email, ...publicReview } = sample.Reviews[0];
        assert.deepEqual(review, publicReview);
        assert.equal(await f.db("users").first(), undefined);
        assert.equal(await f.db("claims").first(), undefined);
        assert.equal(
          (await f.db("businesses").where({ source_id: "one" }).first())
            .owner_id,
          null,
        );
      },
    );
    await t.test(
      "nested category snapshots cannot smuggle private source metadata",
      async () => {
        await importData(f.db, {
          Businesses: [
            {
              id: "nested-public",
              business_name: "Nested source",
              status: "pending",
              category: {
                id: "cat-one",
                name: "Roofers ",
                created_by: "never-import-nested@example.test",
                account: { email: "never-import-nested@example.test" },
              },
              website: "not a valid website value",
              phones: ["530 555 0101", "530 555 0102"],
              contact_person: "Published business contact",
              contact_metadata: { private_phone: "never-import-private-phone" },
              source_data: { private_value: "never-import-recursive" },
              description: { private_value: "never-import-wrong-type" },
            },
          ],
        });
        const snapshot = JSON.parse(
          (
            await f
              .db("businesses")
              .where({ source_id: "nested-public" })
              .first()
          ).source_data,
        );
        assert.deepEqual(snapshot.category, {
          id: "cat-one",
          name: "Roofers ",
        });
        assert.equal(snapshot.website, "not a valid website value");
        assert.deepEqual(snapshot.phones, ["530 555 0101", "530 555 0102"]);
        assert.equal(snapshot.contact_person, "Published business contact");
        assert.equal(JSON.stringify(snapshot).includes("never-import"), false);
        assert.equal(Object.hasOwn(snapshot, "description"), false);
      },
    );
    await t.test(
      "idempotent reimport does not overwrite a local edit",
      async () => {
        await f
          .db("businesses")
          .where({ source_id: "one" })
          .update({ name: "Locally edited" });
        const result = await importData(f.db, sample);
        assert.equal(result.businesses_created, 0);
        assert.equal(
          (await f.db("businesses").where({ source_id: "one" }).first()).name,
          "Locally edited",
        );
      },
    );
    await t.test(
      "explicit refresh changes public fields but never ownership",
      async () => {
        await importData(f.db, sample, { updateExisting: true });
        assert.equal(
          (await f.db("businesses").where({ source_id: "one" }).first()).name,
          "One Roofer ",
        );
      },
    );
    await t.test(
      "invalid import and dry run roll back all writes",
      async () => {
        const bad = {
          Category: [{ id: "newcat", name: "New category" }],
          Businesses: [{ id: "bad" }],
        };
        await assert.rejects(() => importData(f.db, bad));
        assert.equal(
          await f.db("categories").where({ source_id: "newcat" }).first(),
          undefined,
        );
        const result = await importData(
          f.db,
          { Category: [{ id: "dry", name: "Dry category" }] },
          { dryRun: true },
        );
        assert.equal(result.dry_run, true);
        assert.equal(
          await f.db("categories").where({ source_id: "dry" }).first(),
          undefined,
        );
      },
    );
    await t.test("export contains approved public display only", async () => {
      const data = await exportPublic(f.db);
      assert.equal(data.Businesses.length, 2);
      const text = JSON.stringify(data);
      assert.ok(!text.includes("never-publish"));
      assert.ok(!text.includes("never-import"));
      assert.ok(!text.includes("source_data"));
      assert.ok(!text.includes("password"));
      const other = openDatabase({ ...f.config, sqlitePath: ":memory:" });
      try {
        await migrate(other);
        await importData(other, data);
        assert.equal(
          Number((await other("businesses").count({ n: "*" }).first())!.n),
          2,
        );
      } finally {
        await other.destroy();
      }
    });
  } finally {
    await f.close();
  }
});

test("authentication, sessions and CSRF preserve account isolation", async (t) => {
  const f = await fixture();
  try {
    await t.test(
      "all mutations reject absent CSRF and cross-origin request",
      async () => {
        const agent = supertest.agent(f.app);
        const r = await agent.get("/api/session");
        assert.match(r.headers["set-cookie"][0], /HttpOnly/);
        assert.match(r.headers["set-cookie"][0], /SameSite=Lax/);
        assert.equal((await agent.post("/api/contact").send({})).status, 403);
        assert.equal(
          (
            await agent
              .post("/api/contact")
              .set("X-CSRF-Token", r.body.csrfToken)
              .set("Origin", "null")
              .send({})
          ).status,
          403,
        );
        assert.equal(
          (
            await agent
              .post("/api/contact")
              .set("X-CSRF-Token", r.body.csrfToken)
              .set("Origin", "https://evil.example")
              .send({})
          ).status,
          403,
        );
        assert.equal(
          (
            await agent
              .post("/api/contact")
              .set("X-CSRF-Token", "é".repeat(r.body.csrfToken.length))
              .send({})
          ).status,
          403,
        );
      },
    );
    await t.test(
      "signup normalizes email, rotates CSRF and cannot grant staff",
      async () => {
        const a = supertest.agent(f.app);
        const old = (await a.get("/api/session")).body.csrfToken;
        const r = await a
          .post("/api/auth/signup")
          .set("X-CSRF-Token", old)
          .send({
            email: "CASE@EXAMPLE.TEST",
            password: "a-strong-test-password-42",
            is_staff: true,
          });
        assert.equal(r.status, 201);
        assert.equal(r.body.user.email, "case@example.test");
        assert.equal(r.body.user.is_staff, false);
        assert.notEqual(r.body.csrfToken, old);
        assert.equal(
          (await a.post("/api/auth/logout").set("X-CSRF-Token", old).send({}))
            .status,
          403,
        );
        assert.equal(
          (
            await f.db("users").where({ id: r.body.user.id }).first()
          ).password_hash.startsWith("scrypt$"),
          true,
        );
      },
    );
    await t.test(
      "database rejects case-insensitive duplicate account",
      async () => {
        await assert.rejects(() =>
          f
            .db("users")
            .insert({ email: "CASE@example.test", created_at: now() }),
        );
      },
    );
    await t.test(
      "login is case-insensitive and logout rotates session",
      async () => {
        const u = await f.actor();
        const before = u.csrf;
        const out = await u.post("/api/auth/logout");
        assert.equal(out.body.user, null);
        u.csrf = out.body.csrfToken;
        const login = await u.post("/api/auth/login", {
          email: u.email.toUpperCase(),
          password: "a-strong-test-password-42",
        });
        assert.equal(login.status, 200);
        assert.notEqual(login.body.csrfToken, before);
        assert.equal(login.body.user.id, u.id);
      },
    );
    await t.test(
      "session store persists across a second app instance",
      async () => {
        const u = await f.actor();
        const rows = await f.db("sessions");
        const store = new DatabaseSessionStore(f.db);
        const session = await new Promise<any>((resolve, reject) =>
          store.get(
            rows.find((r) => JSON.parse(r.data).userId === u.id)!.sid,
            (e, d) => (e ? reject(e) : resolve(d)),
          ),
        );
        assert.equal(session.userId, u.id);
        assert.equal(session.authVersion, 1);
      },
    );
    await t.test(
      "private account and admin require authorization",
      async () => {
        assert.equal((await supertest(f.app).get("/api/account")).status, 401);
        const u = await f.actor();
        assert.equal((await u.a.get("/api/admin")).status, 403);
        assert.equal((await u.a.get("/api/admin/export")).status, 403);
      },
    );
    await t.test(
      "file-only password reset is single-use and revokes old sessions",
      async () => {
        const u = await f.actor();
        const result = await u.post("/api/auth/password-reset", {
          email: u.email,
        });
        assert.equal(result.status, 200);
        assert.equal(JSON.stringify(result.body).includes("token"), false);
        const files = await fs.readdir(f.config.emailRoot);
        const delivery = JSON.parse(
          await fs.readFile(path.join(f.config.emailRoot, files[0]), "utf8"),
        );
        const resetToken = delivery.text.match(
          /\/accounts\/reset\/([^/]+)\//,
        )[1];
        const a = supertest.agent(f.app);
        const csrf = (await a.get("/api/session")).body.csrfToken;
        assert.equal(
          (
            await a
              .post("/api/auth/password-reset/confirm")
              .set("X-CSRF-Token", csrf)
              .send({
                token: resetToken,
                password: "a-new-strong-test-password-56",
              })
          ).status,
          200,
        );
        assert.equal((await u.a.get("/api/account")).status, 401);
        const next = (await a.get("/api/session")).body.csrfToken;
        assert.equal(
          (
            await a
              .post("/api/auth/password-reset/confirm")
              .set("X-CSRF-Token", next)
              .send({
                token: resetToken,
                password: "a-new-strong-test-password-56",
              })
          ).status,
          400,
        );
      },
    );
  } finally {
    await f.close();
  }
});

test("public directory and moderated workflows enforce server-side privileges", async (t) => {
  const f = await fixture();
  try {
    const user = await f.actor(),
      other = await f.actor(),
      admin = await f.actor(true);
    const one = await f.db("businesses").where({ source_id: "one" }).first(),
      two = await f.db("businesses").where({ source_id: "two" }).first();
    let submission: any, claim: any;
    await t.test(
      "search/filter public records, pending hidden and source metadata omitted",
      async () => {
        const r = await user.a.get("/api/businesses?q=one");
        assert.equal(r.body.total_count, 1);
        assert.equal(r.body.business_count, 2);
        assert.equal(
          (await user.a.get("/api/businesses/hidden-roofer")).status,
          404,
        );
        assert.equal(JSON.stringify(r.body).includes("source_data"), false);
        assert.equal(JSON.stringify(r.body).includes("claimed_by"), false);
        assert.equal(r.body.businesses[0].verified, true);
      },
    );
    await t.test(
      "favorites are authenticated, account-scoped and toggle",
      async () => {
        assert.equal(
          (await user.post(`/api/businesses/${one.slug}/favorite`)).body
            .favorite,
          true,
        );
        assert.equal((await user.a.get("/api/favorites")).body.total_count, 1);
        assert.equal((await other.a.get("/api/favorites")).body.total_count, 0);
        assert.equal(
          (await user.post(`/api/businesses/${one.slug}/favorite`)).body
            .favorite,
          false,
        );
      },
    );
    await t.test(
      "public business submissions are pending and reject escalation",
      async () => {
        const r = await user.post("/api/businesses", {
          name: "New submission",
          category_id: one.category_id,
          status: "approved",
          owner_id: user.id,
          is_premium: true,
        });
        assert.equal(r.status, 201);
        submission = r.body.business;
        const actual = await f
          .db("businesses")
          .where({ id: submission.id })
          .first();
        assert.equal(actual.status, "pending");
        assert.equal(actual.owner_id, null);
        assert.equal(!!actual.is_premium, false);
        assert.equal(
          (await other.a.get(`/api/account/businesses/${submission.id}`))
            .status,
          404,
        );
      },
    );
    await t.test("duplicate requires explicit confirmation", async () => {
      const body = {
        name: "Duplicate",
        category_id: one.category_id,
        phones: "5305550100",
      };
      const result = await user.post("/api/businesses", body);
      assert.equal(result.status, 409);
      assert.equal(result.body.duplicates[0].id, one.id);
      assert.equal(
        (
          await user.post("/api/businesses", {
            ...body,
            confirm_separate: true,
          })
        ).status,
        201,
      );
    });
    await t.test("submitter may edit only a pending listing", async () => {
      assert.equal(
        (
          await user.patch(`/api/account/businesses/${submission.id}`, {
            name: "Revised pending",
            category_id: one.category_id,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await admin.post(`/api/admin/businesses/${submission.id}/moderate`, {
            status: "approved",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await user.patch(`/api/account/businesses/${submission.id}`, {
            name: "Not owner",
            category_id: one.category_id,
          })
        ).status,
        404,
      );
    });
    await t.test(
      "claim does not confer access; approval needs explicit verification",
      async () => {
        const r = await user.post(`/api/businesses/${two.slug}/claims`, {
          evidence: "I operate this business.",
          phone: "5305550101",
        });
        assert.equal(r.status, 201);
        claim = r.body.claim;
        assert.equal(
          (await user.a.get(`/api/account/businesses/${two.id}`)).status,
          404,
        );
        assert.equal(
          (
            await other.post(`/api/admin/claims/${claim.id}/moderate`, {
              status: "approved",
              ownership_verified: true,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.post(`/api/admin/claims/${claim.id}/moderate`, {
              status: "approved",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.post(`/api/admin/claims/${claim.id}/moderate`, {
              status: "approved",
              ownership_verified: true,
            })
          ).status,
          200,
        );
        assert.equal(
          (await user.a.get(`/api/account/businesses/${two.id}`)).status,
          200,
        );
      },
    );
    await t.test(
      "owner edit resubmits moderation, without giving access to other user",
      async () => {
        assert.equal(
          (
            await user.patch(`/api/account/businesses/${two.id}`, {
              name: "Owner update",
              category_id: one.category_id,
            })
          ).status,
          200,
        );
        assert.equal(
          (await f.db("businesses").where({ id: two.id }).first()).status,
          "pending",
        );
        assert.equal(
          (await other.a.get(`/api/account/businesses/${two.id}`)).status,
          404,
        );
        await admin.post(`/api/admin/businesses/${two.id}/moderate`, {
          status: "approved",
        });
      },
    );
    await t.test(
      "ownership conflict never replaces current owner",
      async () => {
        const id = (
          await f
            .db("claims")
            .insert({
              business_id: two.id,
              user_id: other.id,
              evidence: "Conflicting claim",
              created_at: now(),
            })
            .returning("id")
        )[0].id;
        assert.equal(
          (
            await admin.post(`/api/admin/claims/${id}/moderate`, {
              status: "approved",
              ownership_verified: true,
            })
          ).status,
          409,
        );
        assert.equal(
          (await f.db("businesses").where({ id: two.id }).first()).owner_id,
          user.id,
        );
      },
    );
    await t.test(
      "reviews validate rating, disallow owner, moderate and upsert one per user",
      async () => {
        assert.equal(
          (
            await user.post(`/api/businesses/${two.slug}/reviews`, {
              display_name: "Owner",
              rating: 5,
              body: "Mine",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await other.post(`/api/businesses/${two.slug}/reviews`, {
              display_name: "Neighbor",
              rating: 6,
              body: "Rating",
            })
          ).status,
          400,
        );
        const r = await other.post(`/api/businesses/${two.slug}/reviews`, {
          display_name: "Neighbor",
          rating: 4,
          body: "Helpful",
        });
        assert.equal(r.status, 201);
        assert.equal(r.body.review.status, "pending");
        assert.equal(
          (await other.a.get(`/api/businesses/${two.slug}`)).body.reviews
            .length,
          0,
        );
        await admin.post(`/api/admin/reviews/${r.body.review.id}/moderate`, {
          status: "approved",
        });
        assert.equal(
          (await other.a.get(`/api/businesses/${two.slug}`)).body.business
            .average_rating,
          4,
        );
        await other.post(`/api/businesses/${two.slug}/reviews`, {
          display_name: "Neighbor",
          rating: 3,
          body: "Updated",
        });
        assert.equal(
          Number(
            (await f
              .db("reviews")
              .where({ business_id: two.id, user_id: other.id })
              .count({ n: "*" })
              .first())!.n,
          ),
          1,
        );
        assert.equal(
          (await other.a.get(`/api/businesses/${two.slug}`)).body.reviews
            .length,
          0,
        );
      },
    );
    await t.test(
      "edit,remove,duplicate,url and contact requests queue without mutation or outbound email",
      async () => {
        for (const kind of ["edit", "remove", "merge"])
          assert.equal(
            (
              await user.post(`/api/businesses/${one.slug}/suggestions`, {
                kind,
                name: "Pat",
                email: user.email,
                message: "Please review",
              })
            ).status,
            201,
          );
        assert.equal(
          (
            await user.post("/api/suggestions/url", {
              source_url: "http://127.0.0.1/internal",
              name: "Pat",
              email: user.email,
              message: "Queue only, never fetched",
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await user.post("/api/contact", {
              name: "Pat",
              email: user.email,
              subject: "Question",
              message: "Hello",
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await user.post("/api/contact", {
              name: "Bot",
              email: user.email,
              subject: "Spam",
              message: "Hello",
              company_website: "spam",
            })
          ).status,
          400,
        );
        assert.equal(
          (await f.db("businesses").where({ id: one.id }).first()).status,
          "approved",
        );
        const queue = await admin.a.get("/api/admin");
        assert.equal(queue.body.suggestions.length, 4);
        assert.equal(queue.body.contacts.length, 1);
        await assert.rejects(() => fs.readdir(f.config.emailRoot));
      },
    );
    await t.test(
      "website extraction is staff-only and rejects private destinations",
      async () => {
        assert.equal(
          (
            await user.post("/api/account/extract-url", {
              source_url: "https://example.com",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.post("/api/account/extract-url", {
              source_url: "http://127.0.0.1/private",
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "OCR and unconfigured Google are truthful without authenticating",
      async () => {
        assert.equal((await user.post("/api/scan-card")).status, 503);
        assert.equal((await user.post("/api/auth/google/start")).status, 503);
        const s = (await user.a.get("/api/session")).body;
        assert.equal(s.features.google, false);
        assert.equal(s.features.ocr, false);
      },
    );
  } finally {
    await f.close();
  }
});

test("image upload is reencoded, session-owned and traversal-safe", async (t) => {
  const f = await fixture();
  try {
    const user = await f.actor(),
      other = await f.actor();
    const png = await sharp({
      create: {
        width: 24,
        height: 16,
        channels: 4,
        background: { r: 100, g: 40, b: 60, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    let key: string;
    await t.test("rejects SVG and invalid content", async () => {
      await assert.rejects(() =>
        cleanImage(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        ),
      );
      assert.equal(
        (
          await user.a
            .post("/api/uploads")
            .set("X-CSRF-Token", user.csrf)
            .attach("image", Buffer.from("not an image"), "test.jpg")
        ).status,
        400,
      );
    });
    await t.test(
      "sanitizes PNG to randomly named JPEG and serves only safe media key",
      async () => {
        const r = await user.a
          .post("/api/uploads")
          .set("X-CSRF-Token", user.csrf)
          .attach("image", png, "private-original-filename.png");
        assert.equal(r.status, 201);
        key = r.body.key;
        assert.match(key, /^businesses\/[a-f0-9]{32}\.jpg$/);
        const image = await user.a.get(r.body.url);
        assert.equal(image.status, 200);
        assert.match(image.headers["content-type"], /image\/jpeg/);
        assert.equal((await sharp(image.body).metadata()).format, "jpeg");
        assert.equal(
          (await user.a.get("/media/businesses/..%2F..%2F.env")).status,
          404,
        );
      },
    );
    await t.test(
      "another session cannot attach upload and missing CSRF is rejected before processing",
      async () => {
        const cat = (await f.db("categories").first()).id;
        assert.equal(
          (
            await other.post("/api/businesses", {
              name: "Stolen image",
              category_id: cat,
              image: key,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await user.post("/api/businesses", {
              name: "Own image",
              category_id: cat,
              image: key,
            })
          ).status,
          201,
        );
        assert.equal(
          (await user.a.post("/api/uploads").attach("image", png, "image.png"))
            .status,
          403,
        );
      },
    );
  } finally {
    await f.close();
  }
});

test("Google OAuth start binds state, PKCE, nonce and callback rejects invalid state", async () => {
  const f = await fixture();
  try {
    const config = {
      ...f.config,
      googleClientId: "test-client-id.apps.googleusercontent.com",
      googleClientSecret: "test-client-secret",
    };
    const app = createApp(f.db, config);
    const a = supertest.agent(app);
    const csrf = (await a.get("/api/session")).body.csrfToken;
    assert.equal((await a.get("/api/auth/google/start")).status, 404);
    assert.equal((await a.post("/api/auth/google/start").send({})).status, 403);
    const r = await a
      .post("/api/auth/google/start")
      .set("X-CSRF-Token", csrf)
      .send({});
    assert.equal(r.status, 200);
    const url = new URL(r.body.url);
    assert.equal(url.hostname, "accounts.google.com");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("state"));
    assert.ok(url.searchParams.get("nonce"));
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://localhost:3000/api/auth/google/callback",
    );
    assert.equal(
      (
        await a.get(
          "/api/auth/google/callback?state=invalid&code=never-exchange",
        )
      ).status,
      400,
    );
    assert.equal((await a.get("/api/session")).body.user, null);
  } finally {
    await f.close();
  }
});

test("website metadata parser stays bounded to observed values and SSRF rejects nonpublic ranges", () => {
  const draft = extractMetadata(
    '<title>Fallback</title><script type="application/ld+json">{"@type":"LocalBusiness","name":"Observed roofer","telephone":"5305550100","address":{"streetAddress":"1 Main St","addressLocality":"Cool"}}</script>',
    "https://example.com",
  );
  assert.equal(draft.name, "Observed roofer");
  assert.equal(draft.city, "Cool");
  assert.equal(draft.phones, "5305550100");
  assert.equal(draft.email, "");
  for (const address of [
    "127.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "10.0.0.1",
    "172.16.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("8.8.8.8"), true);
  for (const url of [
    "file:///etc/passwd",
    "http://user:pass@example.com",
    "http://example.com:1234",
    "http://localhost",
  ])
    assert.throws(() => validateWebsiteUrl(url));
});

test("retained public seed materializes342 businesses,73original categories+14 referenced and one review", async () => {
  const f = await fixture();
  try {
    await f.db("reviews").delete();
    await f.db("businesses").delete();
    await f.db("categories").delete();
    const result = await seed(
      f.db,
      path.join(process.cwd(), "data/public-seed.json"),
    );
    assert.equal(result.businesses_created, 342);
    assert.equal(result.categories_created, 87);
    assert.equal(result.reviews_created, 1);
    const payload = JSON.parse(
      await fs.readFile("data/public-seed.json", "utf8"),
    );
    assert.equal(payload.Category.length, 73);
    const rows = await f.db("businesses");
    for (const source of payload.Businesses)
      assert.equal(
        rows.find((r) => r.source_id === source.id)?.name,
        source.business_name,
      );
    for (const [sourceKey, table] of [
      ["Category", "categories"],
      ["Businesses", "businesses"],
      ["Reviews", "reviews"],
    ]) {
      const snapshots = await f.db(table).select("source_id", "source_data");
      for (const source of payload[sourceKey])
        assert.deepEqual(
          JSON.parse(
            snapshots.find((r) => r.source_id === source.id)!.source_data,
          ),
          source,
          `${sourceKey} ${source.id} preserves every original public field`,
        );
    }
    const second = await seed(
      f.db,
      path.join(process.cwd(), "data/public-seed.json"),
    );
    assert.equal(second.businesses_created, 0);
    assert.equal(second.categories_created, 0);
  } finally {
    await f.close();
  }
});

test("client updates overlay applies over the preserved seed only when its records change", async () => {
  const f = await fixture();
  try {
    await f.db("reviews").delete();
    await f.db("businesses").delete();
    await f.db("categories").delete();
    const base = path.join(process.cwd(), "data/public-seed.json");
    const overlay = path.join(process.cwd(), "data/client-updates.json");
    const baseIds = new Set(
      JSON.parse(await fs.readFile(base, "utf8")).Businesses.map(
        (b: any) => b.id,
      ),
    );
    const updates = JSON.parse(await fs.readFile(overlay, "utf8"));
    assert.ok(updates.Businesses.length >= 1);
    for (const row of updates.Businesses) {
      assert.ok(baseIds.has(row.id), `${row.id} must exist in the base seed`);
      await fs.access(path.join(process.cwd(), row.image_url.slice(1)));
    }
    const first = await seed(f.db, base, overlay);
    assert.equal(first.businesses_created, 342);
    assert.equal(first.client_updates.updated, updates.Businesses.length);
    assert.equal(first.client_updates.businesses_created, 0);
    assert.equal(first.client_updates.categories_created, 0);
    assert.equal(
      Number((await f.db("businesses").count("id as n").first())!.n),
      342,
    );
    const csl = await f
      .db("businesses")
      .where({ source_id: "69a14ac00c472525c8f82f57" })
      .first();
    const expected = updates.Businesses.find(
      (b: any) => b.id === csl.source_id,
    );
    assert.equal(csl.name, expected.business_name);
    assert.equal(csl.description, expected.services_specialties);
    assert.equal(csl.email, expected.email);
    assert.equal(csl.image_url, expected.image_url);
    assert.equal(csl.status, "approved");
    assert.equal(csl.imported_claim_status, "approved");
    assert.equal(csl.owner_id, null);
    assert.equal(
      (await f.db("categories").where({ id: csl.category_id }).first())!.name,
      expected.category,
    );
    const second = await seed(f.db, base, overlay);
    assert.equal(second.client_updates.updated, 0);
    assert.equal(second.client_updates.skipped, 0);
    await f
      .db("businesses")
      .where({ id: csl.id })
      .update({ description: "Edited locally after the overlay" });
    const third = await seed(f.db, base, overlay);
    assert.equal(third.client_updates.updated, 0);
    assert.equal(
      (await f.db("businesses").where({ id: csl.id }).first())!.description,
      "Edited locally after the overlay",
    );
    const none = await seed(
      f.db,
      base,
      path.join(process.cwd(), "data/does-not-exist.json"),
    );
    assert.equal("client_updates" in none, false);
    await assert.rejects(
      applyClientUpdates(f.db, { Businesses: [{ business_name: "No ID" }] }),
      /stable source ID/,
    );
  } finally {
    await f.close();
  }
});

test("preview framing uses exact origins without relaxing CSRF or non-preview headers", async () => {
  const f = await fixture();
  try {
    const frameOrigin = "https://control.example.test";
    const preview = createApp(
      f.db,
      getConfig({
        ...f.config,
        preview: true,
        previewFrameAncestors: [frameOrigin],
      }),
    );
    const browser = supertest.agent(preview);
    const session = await browser.get("/api/session");
    assert.match(
      session.headers["content-security-policy"],
      /frame-ancestors 'self' https:\/\/control\.example\.test;/,
    );
    assert.equal(session.headers["x-frame-options"], undefined);
    assert.equal(
      (
        await browser
          .post("/api/contact")
          .set("X-CSRF-Token", session.body.csrfToken)
          .set("Origin", frameOrigin)
          .send({})
      ).status,
      403,
    );
    assert.equal(
      (
        await browser
          .post("/api/contact")
          .set("X-CSRF-Token", session.body.csrfToken)
          .set("Origin", "null")
          .send({})
      ).status,
      403,
    );
    const production = createApp(
      f.db,
      getConfig({
        ...f.config,
        production: true,
        preview: false,
        previewFrameAncestors: [frameOrigin],
      }),
    );
    const response = await supertest(production).get("/healthz");
    assert.match(
      response.headers["content-security-policy"],
      /frame-ancestors 'self';/,
    );
    assert.ok(
      !response.headers["content-security-policy"].includes(frameOrigin),
    );
    assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
    for (const invalid of [
      "*",
      "https://*.example.test",
      "null",
      "https://control.example.test/path",
      "https://control.example.test/",
    ])
      assert.throws(() =>
        getConfig({ ...f.config, previewFrameAncestors: [invalid] }),
      );
  } finally {
    await f.close();
  }
});
