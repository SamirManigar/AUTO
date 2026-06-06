// scripts/migrate.mjs
// Run with: npm run migrate
// Requires SUPABASE_ACCESS_TOKEN in .env.local (one-time setup).
// Get yours at: https://supabase.com/dashboard/account/tokens

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL not found in .env.local");
  process.exit(1);
}

if (!accessToken) {
  console.error(`
❌  SUPABASE_ACCESS_TOKEN is missing from .env.local

To get your token:
  1. Go to https://supabase.com/dashboard/account/tokens
  2. Click "Generate new token" → give it any name
  3. Copy the token and add this line to your .env.local:

     SUPABASE_ACCESS_TOKEN="your-token-here"

  4. Re-run: npm run migrate
`);
  process.exit(1);
}

const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) {
  console.error("❌  Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}
const projectRef = refMatch[1];

const sql = readFileSync(resolve(root, "supabase", "schema.sql"), "utf8");

console.log(`🔌  Applying schema to project: ${projectRef}`);

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await response.json().catch(() => ({}));

if (response.ok) {
  console.log("✅  schema.sql applied — tables, indexes, triggers, RLS policies and grants are all set.");
} else {
  console.error(`❌  Migration failed (${response.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}
