const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");

async function main() {
  if (fs.existsSync(".env.local") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env.local");
  if (process.env.VERCEL === "1" || /^postgres/.test(process.env.DATABASE_URL || "")) throw new Error("Use Prisma migrate deploy with the PostgreSQL schema for hosted databases.");
  process.env.DATABASE_URL ||= "file:./dev.db";
  const client = new PrismaClient();
  try {
    const columns = await client.$queryRawUnsafe('PRAGMA table_info("StudioWorkspace")');
    if (columns.length && !columns.some((column) => column.name === "userId")) {
      // The new column is nullable and all old rows get NULL; the unique index
      // cannot conflict with existing data. Never use --accept-data-loss.
      await client.$executeRawUnsafe('ALTER TABLE "StudioWorkspace" ADD COLUMN "userId" TEXT');
      await client.$executeRawUnsafe('CREATE UNIQUE INDEX "StudioWorkspace_userId_key" ON "StudioWorkspace"("userId")');
    }
  } finally { await client.$disconnect(); }
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "db", "push"], { stdio: "inherit" });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
