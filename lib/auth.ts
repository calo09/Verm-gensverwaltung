import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

/** Liefert den angemeldeten Nutzer oder leitet zum Login um. */
export async function requireUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);
  if (!userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  return user;
}

export function registrationAllowed() {
  return process.env.ALLOW_REGISTRATION !== "false";
}
