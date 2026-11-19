import Link from "next/link";
import { NetWorthChart } from "@/components/NetWorthChart";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { ShareBars } from "@/components/ShareBars";
import { db } from "@/lib/db";
import { ASSET_TYPE_LABELS } from "@/lib/assetTypes";
import { requireUser } from "@/lib/auth";
import { loadSummary } from "@/lib/data";
import { formatDate, formatMoney, isoDay } from "@/lib/format";
import { netAt } from "@/lib/portfolio";

const STALE_DAYS = 45;

function Change({ label, now, then }: { label: string; now: number; then: number | null }) {
  if (then === null) return <p className="text-xs text-muted">{label}: noch keine Daten</p>;
  const diff = now - then;
  return (
    <p className={`text-xs ${diff >= 0 ? "text-good" : "text-bad"}`}>
      {label}: {diff >= 0 ? "+" : ""}
      {formatMoney(diff)}
    </p>
  );
}

export default async function Dashboard() {
  const user = await requireUser();
  const s = await loadSummary(user.id);
  const priced = await db.asset.aggregate({
    where: { userId: user.id, autoPrice: true, archived: false },
    _count: true,
    _max: { priceUpdatedAt: true },
  });
  const now = new Date();
  const today = isoDay(now);
  const monthAgo = isoDay(new Date(now.getTime() - 30 * 864e5));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const yearStartValue = netAt(s.history, isoDay(new Date(Date.parse(yearStart) - 864e5)));
  const staleBefore = isoDay(new Date(now.getTime() - STALE_DAYS * 864e5));

  if (s.positions.length === 0) {
    return (
      <div className="card mt-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">Willkommen!</h1>
        <p className="mb-4 text-sm text-muted">Lege deine erste Position an, zum Beispiel dein Girokonto oder dein Depot.</p>
        <Link className="btn" href="/positionen/neu">Erste Position anlegen</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Nettovermögen</p>
          <p className="my-1 text-3xl font-semibold tabular-nums">{formatMoney(s.net)}</p>
          <Change label="seit 30 Tagen" now={s.net} then={netAt(s.history, monthAgo)} />
          <Change label="seit Jahresbeginn" now={s.net} then={yearStartValue} />
        </div>
        <div className="card">
          <p className="text-sm text-muted">Vermögen</p>
          <p className="my-1 text-2xl font-semibold tabular-nums">{formatMoney(s.assets)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Schulden</p>
          <p className="my-1 text-2xl font-semibold tabular-nums">{formatMoney(s.liabilities)}</p>
        </div>
      </section>

      {priced._count > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted">
          {priced._max.priceUpdatedAt && (
            <span>
              Kurse zuletzt abgerufen:{" "}
              {priced._max.priceUpdatedAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" })}
            </span>
          )}
          <RefreshPricesButton />
        </div>
      )}

      <NetWorthChart history={s.history} today={today} />

      <section className="grid gap-4 md:grid-cols-2">
        <ShareBars title="Aufteilung nach Art" rows={s.byType.map((e) => ({ label: ASSET_TYPE_LABELS[e.type], value: e.value }))} />
        <ShareBars title="Aufteilung nach Institut" rows={s.byInstitution.map((e) => ({ label: e.institution, value: e.value }))} />
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Positionen</h2>
          <Link className="btn-ghost" href="/positionen/neu">+ Neu</Link>
        </div>
        <ul className="divide-y divide-border">
          {s.positions.map((p) => {
            const stale = !p.lastDate || p.lastDate < staleBefore;
            return (
              <li key={p.id}>
                <Link href={`/positionen/${p.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">
                      {ASSET_TYPE_LABELS[p.type]}
                      {p.institution && ` · ${p.institution}`}
                      {p.lastDate && ` · Stand ${formatDate(new Date(`${p.lastDate}T00:00:00Z`))}`}
                      {stale && <span className="ml-1 text-bad">· bitte aktualisieren</span>}
                    </p>
                  </div>
                  <p className={`tabular-nums ${p.value < 0 ? "text-bad" : ""}`}>{formatMoney(p.value)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 text-right">
          <a className="text-sm text-accent" href="/export">Alle Werte als CSV exportieren</a>
        </div>
      </section>
    </div>
  );
}
