import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ProviderError } from "./fal";

function positive(value: string | undefined, fallback: number, ceiling: number) {
  const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, ceiling) : fallback;
}
export const dailyLimit = () => positive(process.env.ACCOUNT_DAILY_RENDER_LIMIT, 2, 100);
export const globalLimit = () => positive(process.env.GLOBAL_DAILY_RENDER_LIMIT, 3, 1000);
export const activeLimit = () => positive(process.env.GLOBAL_CONCURRENT_RENDER_LIMIT, 1, 20);
const today = () => new Date().toISOString().slice(0, 10);
export async function usage(workspaceId: string) {
  const quota = await db.studioQuota.findUnique({ where: { id: `account:${workspaceId}:${today()}` } });
  return { used: quota?.used || 0, limit: dailyLimit(), resetsAt: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00Z` };
}
async function reserve(tx: Prisma.TransactionClient, id: string, limit: number, message: string) {
  await tx.studioQuota.upsert({ where: { id }, create: { id }, update: {} });
  const result = await tx.studioQuota.updateMany({ where: { id, used: { lt: limit } }, data: { used: { increment: 1 } } });
  if (!result.count) throw new ProviderError(message, 429);
}
export async function reserveRender(tx: Prisma.TransactionClient, workspaceId: string) {
  // These counters are database-backed and atomic across all Vercel instances.
  await reserve(tx, `global:${today()}`, globalLimit(), "Today's shared free GPU allowance is used up. Come back tomorrow.");
  await reserve(tx, `account:${workspaceId}:${today()}`, dailyLimit(), "You've used today's video allowance. Come back tomorrow.");
  await reserve(tx, "active", activeLimit(), "The studio's GPU is busy. Please wait for the current render to finish.");
}
export async function releaseRender(tx: Prisma.TransactionClient) {
  await tx.studioQuota.updateMany({ where: { id: "active", used: { gt: 0 } }, data: { used: { decrement: 1 } } });
}
