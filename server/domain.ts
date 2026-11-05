import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { DB } from "./db.js";
import { now, insertId } from "./db.js";
import type { User, Business, Category } from "../shared/types.js";
export const localId = () => `local-${randomUUID().replaceAll("-", "")}`;
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-") || "listing";
export async function uniqueSlug(
  db: DB,
  table: string,
  name: string,
  source: string,
) {
  const base = slugify(name);
  return (await db(table).where({ slug: base }).first())
    ? `${base}-${source.slice(-8)}`
    : base;
}
export function safeUrl(value: unknown, local = false): string {
  const s = String(value ?? "").trim();
  if (local && /^\/static\/source-assets\/[a-zA-Z0-9._-]+$/.test(s)) return s;
  if (local && /^\/static\/images\/[a-zA-Z0-9._-]+$/.test(s)) return s;
  if (local && /^\/media\/businesses\/[a-f0-9]{32}\.jpg$/.test(s)) return s;
  if (!s) return "";
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? s
      : "";
  } catch {
    return /^(?:www\.)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?::[0-9]+)?(?:[/#?].*)?$/.test(
      s,
    )
      ? `https://${s}`
      : "";
  }
}
const txt = (x: unknown) => (Array.isArray(x) ? x.join(", ") : String(x ?? ""));
const date = (x: unknown) =>
  typeof x === "string" && Number.isFinite(Date.parse(x))
    ? new Date(x).toISOString()
    : now();
const status = (x: unknown, fallback = "pending") =>
  ["approved", "pending", "rejected"].includes(String(x))
    ? String(x)
    : fallback;
const publicSnapshotFields = {
  categories: [
    "id",
    "source_id",
    "name",
    "slug",
    "image_url",
    "is_popular",
    "is_promoted",
    "popular_icon",
    "popular_order",
    "display_order",
  ],
  businesses: [
    "id",
    "source_id",
    "business_name",
    "name",
    "slug",
    "category",
    "services_specialties",
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
    "display_image_url",
    "premium_image_url",
    "special_offers",
    "is_premium",
    "is_featured",
    "sort_order",
    "status",
    "claim_status",
    "last_verified_date",
    "created_date",
    "updated_date",
    "created_at",
    "updated_at",
  ],
  reviews: [
    "id",
    "source_id",
    "business_id",
    "reviewer_name",
    "display_name",
    "rating",
    "comment",
    "body",
    "status",
    "created_date",
    "updated_date",
    "created_at",
    "updated_at",
  ],
} as const;
const isPublicScalar = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

// Preserve raw public values, not arbitrary upstream account/private metadata.
// Nested values are rejected except the documented public category object shape.
function publicSnapshot(
  row: Record<string, unknown>,
  kind: keyof typeof publicSnapshotFields,
): Record<string, unknown> {
  return Object.fromEntries(
    publicSnapshotFields[kind].flatMap((field): [string, unknown][] => {
      if (!Object.hasOwn(row, field)) return [];
      const value = row[field];
      if (
        isPublicScalar(value) ||
        (Array.isArray(value) && value.every(isPublicScalar))
      )
        return [[field, value]];
      if (
        kind === "businesses" &&
        field === "category" &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      )
        return [
          [
            field,
            publicSnapshot(value as Record<string, unknown>, "categories"),
          ],
        ];
      return [];
    }),
  );
}
export async function importData(
  db: DB,
  payload: any,
  options: { updateExisting?: boolean; dryRun?: boolean } = {},
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Expected a public directory JSON object.");
  const cats = payload.Category ?? payload.categories ?? [],
    businesses = payload.Businesses ?? payload.businesses ?? [],
    reviews = payload.Reviews ?? payload.reviews ?? [];
  if (![cats, businesses, reviews].every(Array.isArray))
    throw new Error("Category, Businesses and Reviews must be arrays.");
  if (!(
    "Category" in payload ||
    "categories" in payload ||
    "Businesses" in payload ||
    "businesses" in payload ||
    "Reviews" in payload ||
    "reviews" in payload
  ))
    throw new Error("No recognized directory arrays.");
  if (cats.length + businesses.length + reviews.length > 50000)
    throw new Error("Import is limited to 50,000 records per operation.");
  const counts = {
    categories_created: 0,
    businesses_created: 0,
    reviews_created: 0,
    updated: 0,
    skipped: 0,
    dry_run: !!options.dryRun,
  };
  const trx = await db.transaction();
  try {
    for (const row of cats) {
      const source_id = txt(row.source_id || row.id),
        name = txt(row.name);
      if (
        !source_id ||
        !name.trim() ||
        source_id.length > 128 ||
        name.length > 150
      )
        throw new Error("Each category requires a stable source ID and name.");
      const existing = await trx("categories").where({ source_id }).first();
      if (existing && !options.updateExisting) {
        counts.skipped++;
        continue;
      }
      const item = {
        source_id,
        name,
        image_url: safeUrl(row.image_url, true),
        is_popular: !!row.is_popular,
        is_promoted: !!row.is_promoted,
        popular_icon: txt(row.popular_icon),
        popular_order:
          Number.isFinite(Number(row.popular_order)) &&
          row.popular_order !== null
            ? Number(row.popular_order)
            : 99,
        display_order: Number(row.display_order) || 0,
        source_data: JSON.stringify(publicSnapshot(row, "categories")),
      };
      if (existing) {
        await trx("categories").where({ id: existing.id }).update(item);
        counts.updated++;
      } else {
        await trx("categories").insert({
          ...item,
          slug: await uniqueSlug(trx, "categories", name, source_id),
        });
        counts.categories_created++;
      }
    }
    for (const row of businesses) {
      const source_id = txt(row.source_id || row.id),
        name = txt(row.business_name || row.name);
      if (
        !source_id ||
        !name.trim() ||
        source_id.length > 128 ||
        name.length > 250
      )
        throw new Error(
          "Every business requires a stable source ID and business_name.",
        );
      const existing = await trx("businesses").where({ source_id }).first();
      if (existing && !options.updateExisting) {
        counts.skipped++;
        continue;
      }
      const categoryName =
        typeof row.category === "object"
          ? txt(row.category?.name)
          : txt(row.category) || "Other";
      let category = await trx("categories")
        .where({ name: categoryName })
        .first();
      if (!category) {
        const id = localId();
        const categoryId = await insertId(trx, "categories", {
          source_id: id,
          name: categoryName,
          slug: await uniqueSlug(trx, "categories", categoryName, id),
        });
        category = { id: categoryId };
        counts.categories_created++;
      }
      const item: Record<string, any> = {
        source_id,
        name,
        category_id: category.id,
        description: txt(row.services_specialties || row.description),
        website: safeUrl(row.website),
        image_url: safeUrl(row.image_url || row.display_image_url, true),
        premium_image_url: safeUrl(row.premium_image_url, true),
        is_premium: !!row.is_premium,
        is_featured: !!row.is_featured,
        sort_order: Number(row.sort_order) || 0,
        status: status(row.status),
        imported_claim_status: txt(row.claim_status),
        source_data: JSON.stringify(publicSnapshot(row, "businesses")),
        created_at: date(row.created_date || row.created_at),
        updated_at: now(),
      };
      for (const f of [
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
        "special_offers",
        "last_verified_date",
      ])
        item[f] = txt(row[f]);
      if (existing) {
        await trx("businesses").where({ id: existing.id }).update(item);
        counts.updated++;
      } else {
        await trx("businesses").insert({
          ...item,
          slug: await uniqueSlug(trx, "businesses", name, source_id),
        });
        counts.businesses_created++;
      }
    }
    for (const row of reviews) {
      const source_id = txt(row.source_id || row.id);
      const business = await trx("businesses")
        .where({ source_id: txt(row.business_id) })
        .first();
      if (!source_id || source_id.length > 128 || !business)
        throw new Error(
          "Every review requires a source ID and imported business_id.",
        );
      const existing = await trx("reviews").where({ source_id }).first();
      if (existing && !options.updateExisting) {
        counts.skipped++;
        continue;
      }
      const rating = Number(row.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        throw new Error("Review ratings must be 1 to 5.");
      const item = {
        source_id,
        business_id: business.id,
        display_name:
          txt(row.reviewer_name || row.display_name) || "Community member",
        rating,
        body: txt(row.comment || row.body),
        status: status(row.status, row.status ? "pending" : "approved"),
        source_data: JSON.stringify(publicSnapshot(row, "reviews")),
        created_at: date(row.created_date || row.created_at),
        updated_at: now(),
      };
      if (existing) {
        await trx("reviews").where({ id: existing.id }).update(item);
        counts.updated++;
      } else {
        await trx("reviews").insert(item);
        counts.reviews_created++;
      }
    }
    if (options.dryRun) await trx.rollback();
    else await trx.commit();
    return counts;
  } catch (e) {
    await trx.rollback();
    throw e;
  }
}
export async function seed(db: DB, file: string, updatesFile?: string) {
  const base = await importData(
    db,
    JSON.parse(await fs.readFile(file, "utf8")),
  );
  if (!updatesFile) return base;
  let raw: string;
  try {
    raw = await fs.readFile(updatesFile, "utf8");
  } catch (e: any) {
    if (e?.code === "ENOENT") return base;
    throw e;
  }
  return {
    ...base,
    client_updates: await applyClientUpdates(db, JSON.parse(raw)),
  };
}

// Client-maintained corrections layered over the preserved public seed.
// A record is (re)applied only when its public snapshot differs from the one
// last imported for that source ID, so later administrator/owner edits survive
// seed runs until the overlay file itself changes.
export async function applyClientUpdates(db: DB, payload: any) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Expected a client updates JSON object.");
  const pending: Record<"Category" | "Businesses" | "Reviews", any[]> = {
    Category: [],
    Businesses: [],
    Reviews: [],
  };
  const sources = [
    ["Category", "categories", payload.Category ?? payload.categories ?? []],
    [
      "Businesses",
      "businesses",
      payload.Businesses ?? payload.businesses ?? [],
    ],
    ["Reviews", "reviews", payload.Reviews ?? payload.reviews ?? []],
  ] as const;
  for (const [key, table, rows] of sources) {
    if (!Array.isArray(rows))
      throw new Error("Client updates arrays must be arrays.");
    for (const row of rows) {
      const source_id = txt(row?.source_id || row?.id);
      if (!source_id)
        throw new Error("Every client update requires a stable source ID.");
      const existing = await db(table)
        .where({ source_id })
        .select("source_data")
        .first();
      if (
        !existing ||
        existing.source_data !== JSON.stringify(publicSnapshot(row, table))
      )
        pending[key].push(row);
    }
  }
  return importData(db, pending, { updateExisting: true });
}
export async function categories(db: DB): Promise<Category[]> {
  const rows = await db("categories").orderBy("display_order").orderBy("name");
  const counts: any[] = await db("businesses")
    .where({ status: "approved" })
    .groupBy("category_id")
    .select("category_id")
    .count({ count: "*" });
  return rows.map(({ source_data, ...r }) => ({
    ...r,
    is_popular: !!r.is_popular,
    is_promoted: !!r.is_promoted,
    business_count: Number(
      counts.find((c) => c.category_id === r.id)?.count || 0,
    ),
  }));
}
export const popular = (rows: Category[]) =>
  rows
    .filter((c) => c.is_popular)
    .sort(
      (a, b) =>
        a.popular_order - b.popular_order ||
        a.display_order - b.display_order ||
        a.name.localeCompare(b.name),
    );
export async function businessViews(
  db: DB,
  user?: User | null,
  filter?: (q: any) => any,
): Promise<Business[]> {
  let query = db("businesses");
  if (filter) query = filter(query);
  const rows = await query;
  const cats = await categories(db);
  const ratings: any[] = await db("reviews")
    .where({ status: "approved" })
    .groupBy("business_id")
    .select("business_id")
    .avg({ average: "rating" })
    .count({ count: "*" });
  const faveIds = user
    ? new Set(
        (
          await db("favorites")
            .where({ user_id: user.id })
            .select("business_id")
        ).map((r) => r.business_id),
      )
    : new Set();
  return rows.map((r) => {
    const primary = r.phones.match(
      /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/,
    );
    const primary_phone = primary
      ? primary.slice(1).join("")
      : r.phones.split(",")[0].replace(/[^0-9+]/g, "");
    const rating = ratings.find((a) => a.business_id === r.id);
    const { source_data, moderation_notes, image, ...clean } = r;
    return {
      ...clean,
      category: cats.find((c) => c.id === r.category_id)!,
      primary_phone,
      display_phone:
        primary_phone.length === 10
          ? `(${primary_phone.slice(0, 3)}) ${primary_phone.slice(3, 6)}-${primary_phone.slice(6)}`
          : r.phones,
      display_image_url: image ? `/media/${image}` : r.image_url,
      is_premium: !!r.is_premium,
      is_featured: !!r.is_featured,
      premium_interest: !!r.premium_interest,
      verified: !!r.owner_id || r.imported_claim_status === "approved",
      claim_status: r.owner_id
        ? "approved"
        : r.imported_claim_status || "unclaimed",
      average_rating: rating ? Number(rating.average) : null,
      review_count: Number(rating?.count || 0),
      is_favorite: faveIds.has(r.id),
      can_edit:
        !!user &&
        (user.is_staff ||
          r.owner_id === user.id ||
          (r.submitted_by === user.id && r.status === "pending")),
      ...(!user?.is_staff &&
      r.owner_id !== user?.id &&
      r.submitted_by !== user?.id
        ? { owner_id: undefined, submitted_by: undefined }
        : {}),
    };
  });
}
export function cleanReview(r: any) {
  return {
    id: r.id,
    source_id: r.source_id,
    business_id: r.business_id,
    display_name: r.display_name,
    rating: r.rating,
    body: r.body,
    status: r.status,
    created_at: r.created_at,
  };
}
export async function exportPublic(db: DB) {
  const cats = await categories(db);
  const businesses = await businessViews(db, null, (q) =>
    q.where({ status: "approved" }),
  );
  const ids = new Map(businesses.map((b) => [b.id, b.source_id]));
  const reviews = await db("reviews").where({ status: "approved" });
  return {
    format: "gold-country-directory-public-v1",
    exported_at: now(),
    Category: cats.map(({ id, source_id, business_count, ...c }) => ({
      id: source_id,
      ...c,
    })),
    Businesses: businesses.map((b) => {
      const fields = [
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
        "special_offers",
        "is_premium",
        "is_featured",
        "sort_order",
        "status",
        "premium_image_url",
        "last_verified_date",
      ];
      return {
        ...Object.fromEntries(fields.map((f) => [f, (b as any)[f]])),
        id: b.source_id,
        business_name: b.name,
        category: b.category.name,
        services_specialties: b.description,
        image_url: b.display_image_url,
        created_date: b.created_at,
        claim_status: b.claim_status,
      };
    }),
    Reviews: reviews
      .filter((r) => ids.has(r.business_id))
      .map((r) => ({
        id: r.source_id,
        business_id: ids.get(r.business_id),
        rating: r.rating,
        comment: r.body,
        reviewer_name: r.display_name,
        created_date: r.created_at,
        status: r.status,
      })),
  };
}
