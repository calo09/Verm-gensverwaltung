"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

type Props = {
  mode: "login" | "register";
  action: (state: FormState, form: FormData) => Promise<FormState>;
  registrationOpen?: boolean;
};

export function AuthForm({ mode, action, registrationOpen = true }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const isLogin = mode === "login";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">Vermögensverwaltung</h1>
      <p className="mb-6 text-sm text-muted">{isLogin ? "Melde dich an." : "Lege dein Konto an."}</p>
      <form action={formAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 10}
            required
          />
        </div>
        {!isLogin && (
          <div>
            <label className="label" htmlFor="password2">Passwort wiederholen</label>
            <input className="input" id="password2" name="password2" type="password" autoComplete="new-password" required />
          </div>
        )}
        {state?.error && <p className="text-sm text-bad">{state.error}</p>}
        <SubmitButton className="btn w-full">{isLogin ? "Anmelden" : "Konto anlegen"}</SubmitButton>
      </form>
      {isLogin && registrationOpen && (
        <p className="mt-4 text-center text-sm text-muted">
          Noch kein Konto? <Link className="text-accent" href="/registrieren">Registrieren</Link>
        </p>
      )}
      {!isLogin && (
        <p className="mt-4 text-center text-sm text-muted">
          Schon registriert? <Link className="text-accent" href="/login">Anmelden</Link>
        </p>
      )}
    </main>
  );
}
