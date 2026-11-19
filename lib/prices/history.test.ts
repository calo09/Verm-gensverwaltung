import { test } from "node:test";
import assert from "node:assert/strict";
import { cryptoHistory, securityHistory } from "./history.ts";
import type { Fetcher } from "./providers.ts";

const fake = (routes: Record<string, unknown>): Fetcher =>
  (async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    return key ? new Response(JSON.stringify(routes[key])) : new Response("", { status: 404 });
  }) as Fetcher;

test("Yahoo-Verlauf: Lücken raus, sortiert, Zeitraum wird übersetzt", async () => {
  const h = await securityHistory(
    fake({
      "chart/VWCE.DE?range=1y&interval=1d": {
        chart: { result: [{ meta: { currency: "EUR", longName: "Vanguard FTSE All-World" }, timestamp: [300, 100, 200], indicators: { quote: [{ open: [3, 1, null], high: [3.5, 1.5, 2], low: [2.5, 0.5, 1], close: [3.2, 1.2, 2], volume: [30, 10, 20] }] } }] },
      },
    }),
    "IE00BK5BQT80",
    "1J",
    "VWCE.DE",
  );
  assert.equal(h.name, "Vanguard FTSE All-World");
  assert.deepEqual(h.candles.map((c) => c.time), [100, 300]);
  assert.equal(h.candles[0].volume, 10);
});

test("CoinGecko-OHLC in Sekunden", async () => {
  const h = await cryptoHistory(fake({ "coins/bitcoin/ohlc?vs_currency=eur&days=30": [[2000, 1, 2, 0.5, 1.5], [1000, 1, 2, 0.5, 1.2]] }), "BTC", "1M");
  assert.deepEqual(h.candles.map((c) => c.time), [1, 2]);
  assert.equal(h.currency, "EUR");
});
