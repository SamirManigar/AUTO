import { neon } from "@neondatabase/serverless";

// Neon HTTP client — designed for serverless, no pool management needed
// Creates a single lazy connection that is safely reused across the module lifecycle
const connectionString = process.env.DATABASE_URL || "";

export const sql = neon(connectionString);
