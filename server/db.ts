import knex, { type Knex } from "knex";
import fs from "node:fs";
import path from "node:path";
import type { Config } from "./config.js";
export type DB = Knex;
export const now = () => new Date().toISOString();
export function openDatabase(config: Config): DB {
  if (!config.databaseUrl && config.sqlitePath !== ":memory:")
    fs.mkdirSync(path.dirname(config.sqlitePath), {
      recursive: true,
      mode: 0o700,
    });
  return knex(
    config.databaseUrl
      ? {
          client: "pg",
          connection: config.databaseUrl,
          pool: { min: 0, max: 10 },
        }
      : {
          client: "better-sqlite3",
          connection: { filename: config.sqlitePath },
          useNullAsDefault: true,
          pool: {
            min: 1,
            max: 1,
            afterCreate(conn: any, done: any) {
              conn.pragma("foreign_keys = ON");
              conn.pragma("journal_mode = WAL");
              conn.pragma("busy_timeout = 5000");
              done(null, conn);
            },
          },
        },
  );
}
const migration = {
  name: "001_initial",
  async up(db: DB) {
    await db.schema.createTable("users", (t) => {
      t.increments("id");
      t.string("email", 254).notNullable().unique();
      t.text("password_hash").nullable();
      t.string("first_name").notNullable().defaultTo("");
      t.string("last_name").notNullable().defaultTo("");
      t.boolean("is_staff").notNullable().defaultTo(false);
      t.boolean("is_active").notNullable().defaultTo(true);
      t.integer("auth_version").notNullable().defaultTo(1);
      t.string("created_at").notNullable();
    });
    await db.raw(
      "CREATE UNIQUE INDEX user_email_case_insensitive ON users (lower(email))",
    );
    await db.schema.createTable("oauth_accounts", (t) => {
      t.increments("id");
      t.integer("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      t.string("provider").notNullable();
      t.string("subject").notNullable();
      t.unique(["provider", "subject"]);
    });
    await db.schema.createTable("sessions", (t) => {
      t.string("sid", 128).primary();
      t.text("data").notNullable();
      t.bigInteger("expires").notNullable().index();
    });
    await db.schema.createTable("password_resets", (t) => {
      t.string("token_hash", 64).primary();
      t.integer("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      t.bigInteger("expires").notNullable();
      t.boolean("used").notNullable().defaultTo(false);
    });
    await db.schema.createTable("categories", (t) => {
      t.increments("id");
      t.string("source_id", 128).notNullable().unique();
      t.string("name", 150).notNullable();
      t.string("slug", 170).notNullable().unique();
      t.text("image_url").notNullable().defaultTo("");
      t.boolean("is_popular").notNullable().defaultTo(false);
      t.boolean("is_promoted").notNullable().defaultTo(false);
      t.string("popular_icon").notNullable().defaultTo("");
      t.integer("popular_order").notNullable().defaultTo(99);
      t.integer("display_order").notNullable().defaultTo(0);
      t.text("source_data").notNullable().defaultTo("{}");
    });
    await db.schema.createTable("businesses", (t) => {
      t.increments("id");
      t.string("source_id", 128).notNullable().unique();
      t.string("name", 250).notNullable();
      t.string("slug", 280).notNullable().unique();
      t.integer("category_id").notNullable().references("categories.id");
      for (const f of [
        "description",
        "contact_person",
        "phones",
        "city",
        "address",
        "address_street",
        "address_unit",
        "address_state",
        "address_zip",
        "license",
        "email",
        "website",
        "image_url",
        "image",
        "premium_image_url",
        "special_offers",
        "imported_claim_status",
        "last_verified_date",
        "moderation_notes",
      ])
        t.text(f).notNullable().defaultTo("");
      for (const f of ["is_premium", "is_featured", "premium_interest"])
        t.boolean(f).notNullable().defaultTo(false);
      t.integer("sort_order").notNullable().defaultTo(0);
      t.string("status").notNullable().defaultTo("pending").index();
      t.integer("submitted_by")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.integer("owner_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.text("source_data").notNullable().defaultTo("{}");
      t.string("created_at").notNullable();
      t.string("updated_at").notNullable();
    });
    await db.schema.createTable("claims", (t) => {
      t.increments("id");
      t.integer("business_id")
        .notNullable()
        .references("businesses.id")
        .onDelete("CASCADE");
      t.integer("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      t.text("evidence").notNullable();
      t.string("phone").notNullable().defaultTo("");
      t.string("status").notNullable().defaultTo("pending");
      t.string("created_at").notNullable();
      t.string("reviewed_at").nullable();
      t.integer("reviewed_by")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.text("admin_notes").notNullable().defaultTo("");
      t.unique(["business_id", "user_id"]);
    });
    await db.schema.createTable("reviews", (t) => {
      t.increments("id");
      t.string("source_id", 128).notNullable().unique();
      t.integer("business_id")
        .notNullable()
        .references("businesses.id")
        .onDelete("CASCADE");
      t.integer("user_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.string("display_name", 150).notNullable();
      t.integer("rating").notNullable();
      t.check("rating >= 1 AND rating <= 5");
      t.text("body").notNullable();
      t.string("status").notNullable().defaultTo("pending");
      t.text("source_data").notNullable().defaultTo("{}");
      t.string("created_at").notNullable();
      t.string("updated_at").notNullable();
      t.unique(["business_id", "user_id"]);
    });
    await db.schema.createTable("favorites", (t) => {
      t.increments("id");
      t.integer("business_id")
        .notNullable()
        .references("businesses.id")
        .onDelete("CASCADE");
      t.integer("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      t.string("created_at").notNullable();
      t.unique(["business_id", "user_id"]);
    });
    await db.schema.createTable("suggestions", (t) => {
      t.increments("id");
      t.integer("business_id")
        .nullable()
        .references("businesses.id")
        .onDelete("SET NULL");
      t.integer("user_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.string("kind").notNullable();
      t.string("name", 150).notNullable();
      t.string("email", 254).notNullable();
      t.text("message").notNullable();
      t.text("source_url").notNullable().defaultTo("");
      t.string("status").notNullable().defaultTo("pending");
      t.text("admin_notes").notNullable().defaultTo("");
      t.string("created_at").notNullable();
    });
    await db.schema.createTable("contacts", (t) => {
      t.increments("id");
      t.string("name", 150).notNullable();
      t.string("email", 254).notNullable();
      t.string("subject", 250).notNullable();
      t.text("message").notNullable();
      t.string("created_at").notNullable();
      t.boolean("resolved").notNullable().defaultTo(false);
      t.text("admin_notes").notNullable().defaultTo("");
    });
    await db.schema.createTable("uploads", (t) => {
      t.string("key", 100).primary();
      t.string("session_hash", 64).notNullable();
      t.integer("user_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.string("created_at").notNullable();
    });
    await db.schema.createTable("audit_events", (t) => {
      t.increments("id");
      t.integer("actor_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      t.string("action").notNullable();
      t.string("kind").notNullable();
      t.integer("record_id").nullable();
      t.text("details").notNullable().defaultTo("{}");
      t.string("created_at").notNullable();
    });
  },
  async down() {
    throw new Error(
      "Destructive schema rollback is intentionally not automated. Restore a verified backup.",
    );
  },
};
export async function migrate(db: DB) {
  await db.migrate.latest({
    migrationSource: {
      getMigrations: async () => [migration],
      getMigrationName: (m: any) => m.name,
      getMigration: (m: any) => m,
    },
  });
}
export async function insertId(
  db: DB | Knex.Transaction,
  table: string,
  value: Record<string, any>,
): Promise<number> {
  const [row] = await db(table).insert(value).returning("id");
  return typeof row === "object" ? row.id : Number(row);
}
