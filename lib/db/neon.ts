import { neon } from "@neondatabase/serverless";

// Next.js statically evaluates modules during build time. 
// If we throw here immediately, the build crashes if the env var isn't present during the build step.
export const sql = neon(process.env.DATABASE_URL || "postgresql://dummy@localhost/dummy");
