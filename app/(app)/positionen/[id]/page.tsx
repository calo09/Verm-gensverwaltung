import Link from "next/link";
import { notFound } from "next/navigation";
import { addValuation, deleteAsset, deleteValuation, updateAsset } from "@/app/actions/assets";
import { AssetForm } from "@/components/AssetForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { NetWorthChart } from "@/components/NetWorthChart";
import { PriceChart } from "@/components/PriceChart";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { ValuationForm } from "@/components/ValuationForm";
import { ASSET_TYPE_LABELS, isLiability } from "@/lib/assetTypes";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, isoDay } from "@/lib/format";
import { listInstitutions } from "@/lib/institutions";

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
        {asset.autoPrice && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">
              {asset.quantity?.toNumber().toLocaleString("de-DE", { maximumFractionDigits: 10 })} Stück
              {latest?.price && ` × ${formatMoney(latest.price.toNumber())}`}
              {asset.priceSymbol && ` · ${asset.priceSymbol.replace("coingecko:", "CoinGecko: ")}`}
            </span>
            <RefreshPricesButton label="Kurs jetzt abrufen" />
          </div>
        )}
        {asset.autoPrice && asset.priceError && <p className="mt-2 text-sm text-bad">Letzter Kursabruf fehlgeschlagen: {asset.priceError}</p>}
        <div className="mt-4 border-t border-border pt-4">
          <ValuationForm action={addValuation.bind(null, asset.id)} today={today} />
        </div>
      </section>

      <NetWorthChart history={history} today={today} title="Wert im Verlauf" seriesLabel="Wert" />

      {asset.identifier && (asset.type === "DEPOT" || asset.type === "KRYPTO") && (
        <PriceChart
          q={asset.identifier}
          kind={asset.type === "KRYPTO" ? "crypto" : "security"}
          symbol={asset.priceSymbol}
          quantity={asset.quantity?.toNumber() ?? null}
          height={340}
        />
      )}

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
                <td className="py-2">
                  {formatDate(v.date)}
                  {v.source === "IMPORT" && <span className="text-xs text-muted"> · Import</span>}
                  {v.source === "API" && <span className="text-xs text-muted"> · Kurs</span>}
                </td>
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
        <AssetForm action={updateAsset.bind(null, asset.id)} initial={{
            name: asset.name,
            type: asset.type,
            institution: asset.institution,
            identifier: asset.identifier,
            note: asset.note,
            quantity: asset.quantity?.toNumber() ?? null,
            autoPrice: asset.autoPrice,
          }}
          institutions={await listInstitutions(user.id)} submitLabel="Änderungen speichern" today={today} />
        <form action={deleteAsset.bind(null, asset.id)} className="mt-6 border-t border-border pt-4">
          <ConfirmButton message="Position mit allen Werten endgültig löschen?" className="text-sm text-bad">
            Position löschen
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}
