import { PrismaClient } from "@prisma/client";

// SQLite is the local workspace store. Set DATABASE_URL for a persistent deployment.
process.env.DATABASE_URL ||= "file:./dev.db";
const globalDb = globalThis as unknown as { studioDb?: PrismaClient };
export const db = globalDb.studioDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.studioDb = db;
