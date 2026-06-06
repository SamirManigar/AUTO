import { neon } from "@neondatabase/serverless";

// Neon HTTP client — designed for serverless, no pool management needed
// Creates a single lazy connection that is safely reused across the module lifecycle
const connectionString = process.env.DATABASE_URL || "";

// Initialize safely so it doesn't crash Next.js during build time if env vars are missing
export const sql = connectionString 
  ? neon(connectionString) 
  : ((...args: any[]) => { throw new Error("DATABASE_URL environment variable is missing"); }) as any;
