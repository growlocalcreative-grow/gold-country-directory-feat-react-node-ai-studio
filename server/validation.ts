import { z } from "zod";
import { ApiFailure } from "./auth.js";
const text = (max: number) => z.string().trim().max(max).optional().default("");
export const email = z.string().trim().toLowerCase().email().max(254);
const website = z
  .string()
  .trim()
  .max(1500)
  .refine(
    (s) =>
      !s ||
      (() => {
        try {
          const u = new URL(s);
          return (
            ["http:", "https:"].includes(u.protocol) &&
            !u.username &&
            !u.password
          );
        } catch {
          return false;
        }
      })(),
    "Use a full HTTP or HTTPS website address.",
  )
  .optional()
  .default("");
export const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .refine(
    (s) =>
      ![
        "password1234",
        "123456789012",
        "qwerty123456",
        "passwordpassword",
      ].includes(s.toLowerCase()),
    "Choose a less common password.",
  );
export const signupSchema = z
  .object({
    email,
    password,
    password_confirm: z.string().optional(),
    first_name: text(150),
    last_name: text(150),
  })
  .refine((x) => !x.password_confirm || x.password_confirm === x.password, {
    path: ["password_confirm"],
    message: "Passwords do not match.",
  });
export const passwordSchema = z
  .object({ password, password_confirm: z.string().optional() })
  .refine((x) => !x.password_confirm || x.password_confirm === x.password, {
    path: ["password_confirm"],
    message: "Passwords do not match.",
  });
export const businessSchema = z.object({
  name: z.string().trim().min(1).max(250),
  category_id: z.coerce.number().int().positive(),
  contact_person: text(250),
  phones: text(500),
  city: text(500),
  address_street: text(250),
  address_unit: text(100),
  address_state: text(100),
  address_zip: text(30),
  license: text(250),
  email: z
    .union([email, z.literal("")])
    .optional()
    .default(""),
  website,
  description: text(20000),
  premium_interest: z.boolean().optional().default(false),
  image: z
    .string()
    .regex(/^businesses\/[a-f0-9]{32}\.jpg$/)
    .optional(),
  confirm_separate: z.boolean().optional().default(false),
});
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email,
  subject: z.string().trim().min(1).max(250),
  message: z.string().trim().min(1).max(10000),
  company_website: z.literal("").optional(),
});
export const suggestionSchema = contactSchema.omit({ subject: true });
export const reviewSchema = z.object({
  display_name: z.string().trim().min(1).max(150),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(5000),
});
export const claimSchema = z.object({
  evidence: z.string().trim().min(1).max(10000),
  phone: text(100),
});
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues)
      fields[issue.path.join(".") || "form"] = issue.message;
    throw new ApiFailure(
      400,
      "validation",
      "Please check the highlighted fields.",
      fields,
    );
  }
  return result.data;
}
