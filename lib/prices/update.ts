import "server-only";
import { db } from "../db";
import { PriceError, quoteCrypto, quoteSecurity, type Fetcher } from "./providers";

export type UpdateSummary = { updated: number; failed: { name: string; error: string }[] };

const todayUtc = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);

/**
 * Holt für alle Positionen mit automatischem Kurs den aktuellen Preis und speichert
 * Stückzahl × Kurs als heutigen Wert. Ohne userId: alle Nutzer (für den täglichen Lauf).
 */
export async function updatePrices(opts: { userId?: string; assetId?: string; fetcher?: Fetcher } = {}): Promise<UpdateSummary> {
  const fetcher = opts.fetcher ?? fetch;
  const assets = await db.asset.findMany({
    where: {
      autoPrice: true,
      archived: false,
      quantity: { not: null },
      identifier: { not: null },
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.assetId ? { id: opts.assetId } : {}),
    },
  });

  const summary: UpdateSummary = { updated: 0, failed: [] };
  const date = todayUtc();
  // Gleiche Wertpapiere nur einmal abfragen.
  const cache = new Map<string, Awaited<ReturnType<typeof quoteSecurity>>>();

  for (const a of assets) {
    const key = `${a.type}:${a.identifier!.trim().toUpperCase()}`;
    try {
      let quote = cache.get(key);
      if (!quote) {
        quote = a.type === "KRYPTO" ? await quoteCrypto(fetcher, a.identifier!, a.priceSymbol) : await quoteSecurity(fetcher, a.identifier!, a.priceSymbol);
        cache.set(key, quote);
      }
      const quantity = a.quantity!.toNumber();
      const value = Math.round(quantity * quote.priceEur * 100) / 100;
      await db.$transaction([
        db.valuation.upsert({
          where: { assetId_date: { assetId: a.id, date } },
          create: { assetId: a.id, date, value, quantity, price: quote.priceEur, source: "API" },
          update: { value, quantity, price: quote.priceEur, source: "API" },
        }),
        db.asset.update({ where: { id: a.id }, data: { priceSymbol: quote.symbol, priceError: null, priceUpdatedAt: new Date() } }),
      ]);
      summary.updated++;
    } catch (e) {
      const error = e instanceof PriceError ? e.message : "Kursabruf fehlgeschlagen, später erneut versuchen";
      if (!(e instanceof PriceError)) console.error(`Kursabruf für ${a.id} fehlgeschlagen`, e);
      await db.asset.update({ where: { id: a.id }, data: { priceError: error } });
      summary.failed.push({ name: a.name, error });
    }
  }
  return summary;
}
