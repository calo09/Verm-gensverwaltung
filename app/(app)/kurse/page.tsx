import Link from "next/link";
import { PriceChart } from "@/components/PriceChart";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type Search = { q?: string; kind?: string; symbol?: string };

export default async function KursePage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const watch = await db.asset.findMany({
    where: { userId: user.id, archived: false, type: { in: ["DEPOT", "KRYPTO"] }, identifier: { not: null } },
    orderBy: { name: "asc" },
  });
  const first = watch[0];
  const q = sp.q?.trim() || first?.identifier || "";
  const kind = sp.q ? (sp.kind === "crypto" ? "crypto" : "security") : first?.type === "KRYPTO" ? "crypto" : "security";
  const current = watch.find((a) => a.identifier === q && (a.type === "KRYPTO") === (kind === "crypto"));
  const symbol = sp.q ? sp.symbol : current?.priceSymbol;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Kurse</h1>
        <form key={`${q}|${kind}`} className="flex flex-wrap gap-2" action="/kurse">
          <div className="w-60">
            <input name="q" className="input" placeholder="ISIN, Ticker oder Coin (z. B. BTC)" defaultValue={sp.q ?? ""} aria-label="Suche" />
          </div>
          <div className="w-36">
            <select name="kind" className="input" defaultValue={kind} aria-label="Art">
              <option value="security">Aktie / ETF</option>
              <option value="crypto">Krypto</option>
            </select>
          </div>
          <button className="btn" type="submit">Anzeigen</button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="card h-fit">
          <h2 className="mb-2 text-sm font-semibold">Deine Werte</h2>
          {watch.length === 0 ? (
            <p className="text-xs text-muted">Positionen mit ISIN oder Coin-Kürzel erscheinen hier.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {watch.map((a) => {
                const k = a.type === "KRYPTO" ? "crypto" : "security";
                const selected = a === current;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/kurse?${new URLSearchParams({ q: a.identifier!, kind: k, ...(a.priceSymbol ? { symbol: a.priceSymbol } : {}) })}`}
                      className={`block rounded-md px-2 py-1 ${selected ? "bg-accent text-white" : "hover:bg-bg"}`}
                    >
                      {a.name}
                      <span className={`block text-xs ${selected ? "text-white/80" : "text-muted"}`}>{a.identifier}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {q ? (
          <PriceChart key={`${kind}:${q}`} q={q} kind={kind} symbol={symbol} quantity={current?.quantity?.toNumber() ?? null} />
        ) : (
          <div className="card text-sm text-muted">Suche oben nach einer ISIN, einem Ticker oder einem Coin.</div>
        )}
      </div>
    </div>
  );
}
