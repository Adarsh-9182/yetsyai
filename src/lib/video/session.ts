import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "yetsyai_workspace";

export async function getWorkspace(create = false) {
  const id = cookies().get(COOKIE)?.value;
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const workspace = await db.studioWorkspace.findUnique({ where: { id } });
    if (workspace) return workspace;
  }
  if (!create) return null;
  const workspace = await db.studioWorkspace.create({ data: { id: randomUUID() } });
  cookies().set(COOKIE, workspace.id, {
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
  return (!origin || origin === new URL(request.url).origin)
    && (!fetchSite || fetchSite === "same-origin" || fetchSite === "none");
}
