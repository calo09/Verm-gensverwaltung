"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetTypeKey } from "@/lib/assetTypes";
import { SubmitButton } from "./SubmitButton";

type Initial = {
  name: string;
  type: AssetTypeKey;
  institution: string | null;
  identifier: string | null;
  note: string | null;
  quantity: number | null;
  autoPrice: boolean;
};

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial?: Initial;
  withValuation?: boolean;
  submitLabel: string;
  today: string;
  institutions?: string[];
};

export function AssetForm({ action, initial, withValuation = false, submitLabel, today, institutions = [] }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [type, setType] = useState<AssetTypeKey>(initial?.type ?? "GIROKONTO");
  const [autoPrice, setAutoPrice] = useState(initial?.autoPrice ?? false);
  const priced = type === "DEPOT" || type === "KRYPTO";
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" defaultValue={initial?.name} placeholder="z. B. Girokonto" required />
        </div>
        <div>
          <label className="label" htmlFor="type">Art</label>
          <select className="input" id="type" name="type" value={type} onChange={(e) => setType(e.target.value as AssetTypeKey)}>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="institution">Bank / Broker / Ort</label>
          <input className="input" id="institution" name="institution" defaultValue={initial?.institution ?? ""} placeholder="z. B. Sparkasse" list="asset-institutions" />
          <datalist id="asset-institutions">
            {institutions.map((i) => <option key={i} value={i} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="identifier">Kennung (optional)</label>
          <input
            className="input"
            id="identifier"
            name="identifier"
            defaultValue={initial?.identifier ?? ""}
            placeholder={type === "KRYPTO" ? "Coin-Kürzel, z. B. BTC" : type === "DEPOT" ? "ISIN oder Ticker" : "z. B. IBAN-Ende"}
          />
        </div>
      </div>
      {priced && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="autoPrice" checked={autoPrice} onChange={(e) => setAutoPrice(e.target.checked)} />
            Kurs automatisch abrufen (Wert = Stückzahl × aktueller Kurs)
          </label>
          {autoPrice && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="quantity">Stückzahl</label>
                <input className="input" id="quantity" name="quantity" inputMode="decimal" defaultValue={initial?.quantity?.toLocaleString("de-DE", { maximumFractionDigits: 10 }) ?? ""} placeholder="z. B. 12,5" required />
              </div>
              <p className="text-xs text-muted sm:self-center">
                Der Kurs wird bei jeder Aktualisierung neu geholt, werktags auch automatisch am Abend. Kennung oben ausfüllen.
              </p>
            </div>
          )}
        </div>
      )}
      <div>
        <label className="label" htmlFor="note">Notiz (optional)</label>
        <input className="input" id="note" name="note" defaultValue={initial?.note ?? ""} />
      </div>
      {withValuation && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="value">
              Aktueller Wert in €{autoPrice && priced && <span className="font-normal text-muted"> (optional, wird abgerufen)</span>}
            </label>
            <input className="input" id="value" name="value" inputMode="decimal" placeholder="z. B. 2.500,00" required={!(autoPrice && priced)} />
            <p className="mt-1 text-xs text-muted">Bei Krediten die offene Restschuld als positive Zahl.</p>
          </div>
          <div>
            <label className="label" htmlFor="date">Stand vom</label>
            <input className="input" id="date" name="date" type="date" defaultValue={today} max={today} required />
          </div>
        </div>
      )}
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      {state && !state.error && <p className="text-sm text-good">Gespeichert.</p>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
