"use client";

import { useState, useTransition } from "react";
import { refreshPrices } from "@/app/actions/assets";

export function RefreshPricesButton({ label = "Kurse aktualisieren" }: { label?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshPrices();
            setMsg(
              r.failed.length
                ? { ok: false, text: `${r.updated} aktualisiert, ${r.failed.length} fehlgeschlagen (${r.failed.map((f) => f.name).join(", ")})` }
                : { ok: true, text: `${r.updated} ${r.updated === 1 ? "Kurs" : "Kurse"} aktualisiert` },
            );
          })
        }
      >
        {pending ? "Rufe Kurse ab …" : label}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
    </span>
  );
}
