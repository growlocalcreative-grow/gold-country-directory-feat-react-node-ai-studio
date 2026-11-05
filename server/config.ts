import path from "node:path";
import { randomBytes } from "node:crypto";
export interface Config {
  root: string;
  production: boolean;
  port: number;
  origin: string;
  trustedOrigins: string[];
  sessionSecret: string;
  secureCookies: boolean;
  trustProxy: number | false;
  databaseUrl: string;
  sqlitePath: string;
  mediaRoot: string;
  emailRoot: string;
  preview: boolean;
  previewFrameAncestors: string[];
  googleClientId: string;
  googleClientSecret: string;
  storageBucket: string;
  storagePrefix: string;
  smtpUrl: string;
  smtpFrom: string;
  autoMigrate: boolean;
  autoSeed: boolean;
}
export function getConfig(overrides: Partial<Config> = {}): Config {
  const root = process.cwd();
  const production = process.env.NODE_ENV === "production";
  const port = Number(process.env.PORT || 3000);
  const origin = (
    process.env.APP_ORIGIN ||
    process.env.PUBLIC_URL ||
    `http://localhost:${port}`
  ).replace(/\/$/, "");
  const providedSecret = process.env.SESSION_SECRET;
  if (production && !providedSecret && !overrides.sessionSecret)
    throw new Error(
      "SESSION_SECRET (at least 32 characters) is required in production.",
    );
  const config: Config = {
    root,
    production,
    port,
    origin,
    trustedOrigins: (process.env.TRUSTED_ORIGINS || "")
      .split(",")
      .filter(Boolean),
    sessionSecret: providedSecret || randomBytes(48).toString("base64url"),
    secureCookies: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : origin.startsWith("https:"),
    trustProxy: process.env.TRUST_PROXY
      ? Number(process.env.TRUST_PROXY)
      : false,
    databaseUrl: process.env.DATABASE_URL || "",
    sqlitePath:
      process.env.SQLITE_PATH || path.join(root, "var/directory.sqlite"),
    mediaRoot: process.env.MEDIA_ROOT || path.join(root, "var/media"),
    emailRoot: process.env.EMAIL_FILE_PATH || path.join(root, "var/emails"),
    preview: process.env.PREVIEW_MODE !== "false",
    previewFrameAncestors: (process.env.PREVIEW_FRAME_ANCESTORS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    storageBucket: process.env.GCS_BUCKET || "",
    storagePrefix: process.env.GCS_PREFIX || "businesses",
    smtpUrl: process.env.SMTP_URL || "",
    smtpFrom: process.env.SMTP_FROM || "directory@localhost",
    autoMigrate: process.env.AUTO_MIGRATE
      ? process.env.AUTO_MIGRATE === "true" || process.env.AUTO_MIGRATE === "1"
      : !production,
    autoSeed: process.env.AUTO_SEED
      ? process.env.AUTO_SEED === "true" || process.env.AUTO_SEED === "1"
      : !production,
    ...overrides,
  };
  if (config.sessionSecret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const parsedOrigin = new URL(config.origin);
  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.username ||
    parsedOrigin.password
  )
    throw new Error("APP_ORIGIN must be a plain HTTP(S) origin.");
  if (
    config.trustProxy !== false &&
    (!Number.isInteger(config.trustProxy) || config.trustProxy < 1)
  )
    throw new Error(
      "TRUST_PROXY must be an explicit positive proxy hop count.",
    );
  for (const value of config.previewFrameAncestors) {
    let frame: URL;
    try {
      frame = new URL(value);
    } catch {
      throw new Error(
        "PREVIEW_FRAME_ANCESTORS accepts exact HTTP(S) origins only.",
      );
    }
    if (
      !["http:", "https:"].includes(frame.protocol) ||
      frame.origin !== value ||
      frame.username ||
      frame.password ||
      frame.search ||
      frame.hash ||
      value.includes("*")
    )
      throw new Error(
        "PREVIEW_FRAME_ANCESTORS accepts exact HTTP(S) origins only.",
      );
  }
  return config;
}
