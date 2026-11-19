import type { ImportResult } from "@/lib/csvImport";
import { formatMoney } from "@/lib/format";

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" });

/** Zeigt, was aus der Datei gelesen wurde: erste und letzte Werte sowie Probleme. */
export function ImportPreview({ result, hint }: { result: ImportResult; hint?: string }) {
  const issues = result.issues;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <p className="font-medium">Vorschau</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {result.mode === "HOLDINGS" ? (
        result.holdings.length ? (
          <>
            <p className="text-muted">{result.holdings.length} Positionen erkannt.</p>
            <ul className="divide-y divide-border">
              {result.holdings.slice(0, 8).map((h, i) => (
                <li key={i} className="flex justify-between gap-2 py-1">
                  <span>{h.name}{h.identifier && <span className="text-muted"> · {h.identifier}</span>}</span>
                  <span className="tabular-nums">{formatMoney(h.value)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null
      ) : result.values.length ? (
        <>
          <p className="text-muted">
            {result.usedRows} Zeilen → {result.values.length} Tageswerte vom {fmtDay(result.values[0].date)} bis {fmtDay(result.values.at(-1)!.date)}.
          </p>
          <ul className="divide-y divide-border">
            {[...result.values.slice(0, 3), ...(result.values.length > 6 ? [null] : []), ...result.values.slice(Math.max(3, result.values.length - 3))].map((v, i) =>
              v ? (
                <li key={i} className="flex justify-between py-1">
                  <span>{fmtDay(v.date)}</span>
                  <span className="tabular-nums">{formatMoney(v.value)}</span>
                </li>
              ) : (
                <li key={i} className="py-1 text-center text-muted">…</li>
              ),
            )}
          </ul>
        </>
      ) : null}
      {issues.length > 0 && (
        <div className="text-bad">
          <p>Hinweise:</p>
          <ul className="list-inside list-disc text-xs">
            {issues.slice(0, 5).map((i, k) => (
              <li key={k}>{i.row ? `Zeile ${i.row}: ` : ""}{i.message}</li>
            ))}
            {issues.length > 5 && <li>… und {issues.length - 5} weitere</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
