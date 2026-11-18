import Link from "next/link";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/assetTypes";
import { requireUser } from "@/lib/auth";
import { loadSummary } from "@/lib/data";
import { formatMoney } from "@/lib/format";

export default async function PositionsPage() {
  const user = await requireUser();
  const s = await loadSummary(user.id);
  const groups = ASSET_TYPES.map((t) => ({ type: t, items: s.positions.filter((p) => p.type === t) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Positionen</h1>
        <Link className="btn" href="/positionen/neu">+ Neue Position</Link>
      </div>
      {groups.length === 0 && <p className="card text-sm text-muted">Noch keine Positionen angelegt.</p>}
      {groups.map((g) => (
        <section key={g.type} className="card">
          <div className="mb-2 flex justify-between text-sm">
            <h2 className="font-semibold">{ASSET_TYPE_LABELS[g.type]}</h2>
            <span className="tabular-nums text-muted">{formatMoney(g.items.reduce((sum, p) => sum + p.value, 0))}</span>
          </div>
          <ul className="divide-y divide-border">
            {g.items.map((p) => (
              <li key={p.id}>
                <Link href={`/positionen/${p.id}`} className="flex justify-between gap-3 py-2 hover:opacity-80">
                  <span>
                    {p.name}
                    {p.institution && <span className="text-sm text-muted"> · {p.institution}</span>}
                  </span>
                  <span className={`tabular-nums ${p.value < 0 ? "text-bad" : ""}`}>{formatMoney(p.value)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
