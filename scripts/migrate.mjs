// scripts/migrate.mjs
// Run with: npm run migrate
// Automatically applies db/schema.sql to your Neon database.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {
    // ignore missing file
  }
  return env;
}

const env = loadEnv();
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌  DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sqlText = readFileSync(resolve(root, "db", "schema.sql"), "utf8");

console.log(`🔌  Applying schema to Neon database...`);

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  // Using the pg-compatible Client allows executing raw multi-statement SQL strings
  await client.query(sqlText);
  console.log("✅  schema.sql applied — tables, constraints, and functions are all set.");
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
