import { neon } from "@neondatabase/serverless";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const sql = neon(requireEnv("DATABASE_URL"));
