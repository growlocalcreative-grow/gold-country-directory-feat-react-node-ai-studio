import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config.js";
import { openDatabase, migrate, now } from "./db.js";
import { importData, exportPublic, seed } from "./domain.js";
import { hashPassword } from "./auth.js";
import { email, password, parse } from "./validation.js";
const config = getConfig();
const db = openDatabase(config);
const [command, ...args] = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
try {
  switch (command) {
    case "migrate":
      await migrate(db);
      console.log("Database migrations applied.");
      break;
    case "seed":
      console.log(
        JSON.stringify(
          await seed(
            db,
            path.join(config.root, "data/public-seed.json"),
            path.join(config.root, "data/client-updates.json"),
          ),
        ),
      );
      break;
    case "admin": {
      const address = parse(email, option("--email"));
      const secret = parse(password, process.env.ADMIN_PASSWORD);
      const existing = await db("users").where({ email: address }).first();
      if (existing && !args.includes("--update-existing"))
        throw new Error(
          "Account exists. Use --update-existing explicitly to replace its password and grant administrator status.",
        );
      const data = {
        email: address,
        password_hash: await hashPassword(secret),
        is_staff: true,
        is_active: true,
      };
      if (existing)
        await db("users")
          .where({ id: existing.id })
          .update(data)
          .increment("auth_version", 1);
      else await db("users").insert({ ...data, created_at: now() });
      console.log("Administrator account provisioned. Password not displayed.");
      break;
    }
    case "export": {
      const file = args[0];
      if (!file) throw new Error("Specify an export filename.");
      await fs.writeFile(
        file,
        JSON.stringify(await exportPublic(db), null, 2) + "\n",
        { mode: 0o600 },
      );
      console.log("Public approved directory exported.");
      break;
    }
    case "import": {
      const file = args[0];
      if (!file) throw new Error("Specify a JSON import filename.");
      console.log(
        JSON.stringify(
          await importData(db, JSON.parse(await fs.readFile(file, "utf8")), {
            updateExisting: args.includes("--update-existing"),
            dryRun: args.includes("--dry-run"),
          }),
        ),
      );
      break;
    }
    case "prune-sessions": {
      const count = await db("sessions")
        .where("expires", "<", Date.now())
        .delete();
      await db("password_resets").where("expires", "<", Date.now()).delete();
      console.log(`Expired sessions removed: ${count}.`);
      break;
    }
    default:
      throw new Error(
        "Use migrate, seed, admin --email EMAIL, export FILE, import FILE [--dry-run] [--update-existing], or prune-sessions.",
      );
  }
} finally {
  await db.destroy();
}
