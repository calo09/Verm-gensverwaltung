import { PriceError, resolveCoinId, resolveYahooSymbol, type Fetcher } from "./providers.ts";

/** Eine Kerze; `time` in Sekunden seit 1970 (UTC). */
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type History = { symbol: string; name?: string; currency: string; candles: Candle[] };

export const RANGES = ["1T", "5T", "1M", "3M", "6M", "1J", "5J", "Max"] as const;
export type Range = (typeof RANGES)[number];

const YAHOO: Record<Range, { range: string; interval: string }> = {
  "1T": { range: "1d", interval: "5m" },
  "5T": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1J": { range: "1y", interval: "1d" },
  "5J": { range: "5y", interval: "1wk" },
  Max: { range: "max", interval: "1mo" },
};

const CG_DAYS: Record<Range, string> = { "1T": "1", "5T": "7", "1M": "30", "3M": "90", "6M": "180", "1J": "365", "5J": "max", Max: "max" };

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Vermoegensverwaltung/1.0)" };

async function getJson(fetcher: Fetcher, url: string, headers: Record<string, string> = {}) {
  const res = await fetcher(url, { headers: { ...UA, ...headers }, cache: "no-store" });
  if (!res.ok) throw new PriceError(`Kursanbieter antwortet mit ${res.status}`);
  return res.json();
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function securityHistory(fetcher: Fetcher, identifier: string, range: Range, cachedSymbol?: string | null): Promise<History> {
  const symbol = cachedSymbol && !cachedSymbol.startsWith("coingecko:") ? cachedSymbol : await resolveYahooSymbol(fetcher, identifier);
  const { range: r, interval } = YAHOO[range];
  const data = await getJson(fetcher, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r}&interval=${interval}`);
  const res = data?.chart?.result?.[0];
  if (!res) throw new PriceError(`Keine Kursdaten für ${symbol}`);
  const ts: number[] = res.timestamp ?? [];
  const q = res.indicators?.quote?.[0] ?? {};
  const pence = res.meta?.currency === "GBp" || res.meta?.currency === "GBX";
  const f = pence ? 0.01 : 1;
  const candles: Candle[] = [];
  ts.forEach((t, i) => {
    const [o, h, l, c] = [num(q.open?.[i]), num(q.high?.[i]), num(q.low?.[i]), num(q.close?.[i])];
    if (o === null || h === null || l === null || c === null) return; // Lücken (Feiertage, Handelspausen)
    candles.push({ time: t, open: o * f, high: h * f, low: l * f, close: c * f, volume: num(q.volume?.[i]) ?? undefined });
  });
  return {
    symbol,
    name: res.meta?.longName ?? res.meta?.shortName,
    currency: pence ? "GBP" : (res.meta?.currency ?? "EUR"),
    candles: dedupe(candles),
  };
}

export async function cryptoHistory(fetcher: Fetcher, identifier: string, range: Range, cachedSymbol?: string | null): Promise<History> {
  const id = cachedSymbol?.startsWith("coingecko:") ? cachedSymbol.slice(10) : await resolveCoinId(fetcher, identifier);
  const key = process.env.COINGECKO_API_KEY;
  const rows: number[][] = await getJson(
    fetcher,
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=eur&days=${CG_DAYS[range]}`,
    key ? { "x-cg-demo-api-key": key } : {},
  );
  if (!Array.isArray(rows)) throw new PriceError(`Keine Kursdaten für ${identifier}`);
  const candles = rows
    .filter((r) => r.length >= 5 && r.every((v) => typeof v === "number"))
    .map(([t, o, h, l, c]) => ({ time: Math.floor(t / 1000), open: o, high: h, low: l, close: c }));
  return { symbol: `coingecko:${id}`, currency: "EUR", candles: dedupe(candles) };
}

/** Aufsteigend sortiert, jeder Zeitpunkt nur einmal (das Chart verlangt das). */
function dedupe(candles: Candle[]) {
  const m = new Map<number, Candle>();
  for (const c of candles) m.set(c.time, c);
  return [...m.values()].sort((a, b) => a.time - b.time);
}
