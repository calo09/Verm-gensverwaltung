"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function ValuationForm({
  action,
  today,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  today: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-36 flex-1">
        <label className="label" htmlFor="value">Neuer Wert in €</label>
        <input className="input" id="value" name="value" inputMode="decimal" placeholder="z. B. 2.500,00" required />
      </div>
      <div className="min-w-36 flex-1">
        <label className="label" htmlFor="date">Stand vom</label>
        <input className="input" id="date" name="date" type="date" defaultValue={today} max={today} required />
      </div>
      <SubmitButton>Wert speichern</SubmitButton>
      {state?.error && <p className="w-full text-sm text-bad">{state.error}</p>}
    </form>
  );
}
