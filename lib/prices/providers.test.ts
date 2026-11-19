import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteCrypto, quoteSecurity, resolveYahooSymbol, type Fetcher } from "./providers.ts";

/** Fake-Fetcher: beantwortet URLs anhand von Teilstrings und merkt sich die Aufrufe. */
function fake(routes: Record<string, unknown>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  }) as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

const chart = (price: number, currency: string) => ({ chart: { result: [{ meta: { regularMarketPrice: price, currency } }] } });

test("ISIN wird auf eine Xetra-Notierung aufgelöst", async () => {
  const f = fake({
    "search?q=IE00BK5BQT80": { quotes: [{ symbol: "VWRL.L", exchange: "LSE" }, { symbol: "VWCE.DE", exchange: "GER" }, { symbol: "VWCE.F", exchange: "FRA" }] },
  });
  assert.equal(await resolveYahooSymbol(f, "ie00bk5bqt80"), "VWCE.DE");
});

test("Kurs in Euro, US-Dollar wird umgerechnet, Pence werden zu Pfund", async () => {
  const eur = await quoteSecurity(fake({ "chart/VWCE.DE": chart(125.5, "EUR") }), "IE00BK5BQT80", "VWCE.DE");
  assert.equal(eur.priceEur, 125.5);

  const usd = await quoteSecurity(fake({ "search?q=AAPL": { quotes: [{ symbol: "AAPL", exchange: "NMS" }] }, "chart/AAPL": chart(200, "USD"), "chart/USDEUR%3DX": chart(0.9, "EUR") }), "AAPL");
  assert.equal(usd.symbol, "AAPL");
  assert.equal(usd.priceEur, 180);

  const gbp = await quoteSecurity(fake({ "chart/VWRL.L": chart(10000, "GBp"), "chart/GBPEUR%3DX": chart(1.2, "EUR") }), "x", "VWRL.L");
  assert.equal(gbp.currency, "GBP");
  assert.equal(gbp.priceEur, 120);
});

test("unbekannte ISIN ergibt verständlichen Fehler", async () => {
  await assert.rejects(quoteSecurity(fake({ "search?q=": { quotes: [] } }), "DE0000000000"), /kein Wertpapier/);
});

test("Krypto: bekanntes Kürzel ohne Suche, sonst Suche nach Marktkapitalisierung", async () => {
  const f = fake({ "simple/price?ids=bitcoin": { bitcoin: { eur: 80000 } } });
  const btc = await quoteCrypto(f, "btc");
  assert.deepEqual(btc, { symbol: "coingecko:bitcoin", price: 80000, currency: "EUR", priceEur: 80000 });
  assert.equal(f.calls.length, 1);

  const g = fake({
    "search?query=PEPE": { coins: [{ id: "pepe-fake", symbol: "PEPE", market_cap_rank: 900 }, { id: "pepe", symbol: "PEPE", market_cap_rank: 30 }] },
    "simple/price?ids=pepe": { pepe: { eur: 0.00001 } },
  });
  assert.equal((await quoteCrypto(g, "PEPE")).symbol, "coingecko:pepe");
});
