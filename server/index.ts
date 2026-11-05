import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { getConfig } from "./config.js";
import { openDatabase, migrate } from "./db.js";
import { seed } from "./domain.js";
import { createApp } from "./app.js";
const config = getConfig();
const db = openDatabase(config);
if (config.autoMigrate) await migrate(db);
if (config.autoSeed)
  await seed(
    db,
    path.join(config.root, "data/public-seed.json"),
    path.join(config.root, "data/client-updates.json"),
  );
const app = createApp(db, config);
if (config.production) {
  const directory = path.join(config.root, "dist/client");
  if (!fs.existsSync(path.join(directory, "index.html")))
    throw new Error("Client build not found. Run npm run build first.");
  app.use(express.static(directory, { index: false, maxAge: "1h" }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(directory, "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(config.port, "0.0.0.0", () =>
  console.log(
    `Gold Country Directory ready on port ${config.port} (${config.production ? "production" : "development"}, ${config.databaseUrl ? "PostgreSQL" : "SQLite"}).`,
  ),
);
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
