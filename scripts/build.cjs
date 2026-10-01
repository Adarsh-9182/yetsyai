const { execFileSync } = require("node:child_process");
const path = require("node:path");

const hosted = process.env.VERCEL === "1" || /^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || "");
const schema = hosted ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma";
const prisma = path.resolve("node_modules/prisma/build/index.js");
execFileSync(process.execPath, [prisma, "generate", "--schema", schema], { stdio: "inherit" });
if (hosted && /^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  execFileSync(process.execPath, [prisma, "migrate", "deploy", "--schema", schema], { stdio: "inherit" });
}
execFileSync(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "build"], { stdio: "inherit" });
