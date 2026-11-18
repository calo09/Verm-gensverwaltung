import { formatMoney, formatPercent } from "@/lib/format";

/** Horizontale Balken für Anteile; Schulden werden getrennt und rot dargestellt. */
export function ShareBars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const positives = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const negatives = rows.filter((r) => r.value < 0).sort((a, b) => a.value - b.value);
  const total = positives.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="card">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Werte.</p>
      ) : (
        <ul className="space-y-3">
          {[...positives, ...negatives].map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums text-muted">
                  {formatMoney(r.value)}
                  {r.value > 0 && total > 0 && <> · {formatPercent(r.value / total)}</>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-bg">
                <div
                  className={`h-2 rounded-full ${r.value < 0 ? "bg-bad" : "bg-accent"}`}
                  style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
