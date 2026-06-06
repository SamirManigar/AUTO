// scripts/add-clip-times.mjs
// One-time migration: adds start_time and end_time columns to compilation_clips

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

const migrationSQL = `
ALTER TABLE public.compilation_clips
  ADD COLUMN IF NOT EXISTS start_time double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS end_time double precision NOT NULL DEFAULT 0;
`;

console.log("🔌  Connecting to Neon...");
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(migrationSQL);
  console.log("✅  Migration complete: start_time and end_time added to compilation_clips.");
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
