import Link from "next/link";
import { notFound } from "next/navigation";
import { addValuation, deleteAsset, deleteValuation, updateAsset } from "@/app/actions/assets";
import { AssetForm } from "@/components/AssetForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { NetWorthChart } from "@/components/NetWorthChart";
import { ValuationForm } from "@/components/ValuationForm";
import { ASSET_TYPE_LABELS, isLiability } from "@/lib/assetTypes";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, isoDay } from "@/lib/format";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const asset = await db.asset.findFirst({
    where: { id, userId: user.id },
    include: { valuations: { orderBy: { date: "desc" } } },
  });
  if (!asset) notFound();

  const today = isoDay(new Date());
  const latest = asset.valuations.find((v) => isoDay(v.date) <= today);
  const sign = isLiability(asset.type) ? -1 : 1;
  const history = [...asset.valuations]
    .reverse()
    .map((v) => ({ date: isoDay(v.date), net: sign * v.value.toNumber() }))
    .filter((p) => p.date <= today);

  return (
    <div className="space-y-4">
      <Link href="/positionen" className="text-sm text-muted">← Alle Positionen</Link>
      <section className="card">
        <p className="text-sm text-muted">
          {ASSET_TYPE_LABELS[asset.type]}
          {asset.institution && ` · ${asset.institution}`}
        </p>
        <h1 className="text-2xl font-semibold">{asset.name}</h1>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${sign < 0 ? "text-bad" : ""}`}>
          {formatMoney(latest ? sign * latest.value.toNumber() : 0)}
        </p>
        {latest && <p className="text-xs text-muted">Stand {formatDate(latest.date)}</p>}
        <div className="mt-4 border-t border-border pt-4">
          <ValuationForm action={addValuation.bind(null, asset.id)} today={today} />
        </div>
      </section>

      <NetWorthChart history={history} today={today} title="Wert im Verlauf" seriesLabel="Wert" />

      <section className="card">
        <h2 className="mb-2 font-semibold">Alle Werte</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 font-normal">Datum</th>
              <th className="py-1 text-right font-normal">Wert</th>
              <th className="py-1 font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {asset.valuations.map((v) => (
              <tr key={v.id}>
                <td className="py-2">{formatDate(v.date)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(v.value.toNumber())}</td>
                <td className="py-2 text-right">
                  <form action={deleteValuation.bind(null, v.id)}>
                    <ConfirmButton message="Diesen Wert löschen?" className="text-xs text-muted hover:text-bad">Löschen</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Position bearbeiten</h2>
        <AssetForm action={updateAsset.bind(null, asset.id)} initial={asset} submitLabel="Änderungen speichern" today={today} />
        <form action={deleteAsset.bind(null, asset.id)} className="mt-6 border-t border-border pt-4">
          <ConfirmButton message="Position mit allen Werten endgültig löschen?" className="text-sm text-bad">
            Position löschen
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}
