import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { authClient, authConfigured } from "./auth";

const COOKIE = "yetsyai_workspace";

export async function getWorkspace(create = false) {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (authConfigured()) {
    const client = await authClient();
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      const existing = await db.studioWorkspace.findUnique({ where: { userId: user.id } });
      if (existing) return existing;
      if (id) await db.studioWorkspace.updateMany({ where: { id, userId: null }, data: { userId: user.id } });
      return db.studioWorkspace.upsert({ where: { userId: user.id }, create: { id: randomUUID(), userId: user.id }, update: {} });
    }
  }
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const workspace = await db.studioWorkspace.findUnique({ where: { id } });
    if (workspace && !workspace.userId) return workspace;
  }
  if (!create) return null;
  const workspace = await db.studioWorkspace.create({ data: { id: randomUUID() } });
  store.set(COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return workspace;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === new URL(request.url).origin
    && (!fetchSite || fetchSite === "same-origin" || fetchSite === "none");
}
