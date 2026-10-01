import { PrismaClient } from "@prisma/client";

// Vercel builds use the PostgreSQL schema; local builds retain SQLite.
export function databaseConfigured() {
  return process.env.VERCEL !== "1" || Boolean(process.env.DATABASE_URL?.match(/^postgres(?:ql)?:\/\//));
}
if (process.env.VERCEL !== "1") process.env.DATABASE_URL ||= "file:./dev.db";
const globalDb = globalThis as unknown as { studioDb?: PrismaClient };
export const db = globalDb.studioDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.studioDb = db;
