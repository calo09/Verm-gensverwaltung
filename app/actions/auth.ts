"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { registrationAllowed } from "@/lib/auth";
import { SESSION_COOKIE, signSession, sessionCookieOptions } from "@/lib/session";

export type FormState = { error?: string } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(10, "Das Passwort braucht mindestens 10 Zeichen."),
});

async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  if (!registrationAllowed()) return { error: "Die Registrierung ist deaktiviert." };
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get("password") !== form.get("password2")) return { error: "Die Passwörter stimmen nicht überein." };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "Zu dieser E-Mail-Adresse gibt es schon ein Konto." };

  const user = await db.user.create({
    data: { email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });
  await startSession(user.id);
  redirect("/dashboard");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }
  await startSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
