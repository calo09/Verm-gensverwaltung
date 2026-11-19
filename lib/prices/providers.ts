/**
 * Kursabruf aus kostenlosen Quellen:
 * - Aktien, ETFs, Fonds: Yahoo Finance (inoffizielle, frei zugängliche Schnittstelle; Suche per ISIN oder Ticker)
 * - Krypto: CoinGecko (optional mit kostenlosem Demo-Schlüssel in COINGECKO_API_KEY)
 * Alle Preise werden in Euro umgerechnet.
 */

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type Quote = { symbol: string; priceEur: number; price: number; currency: string };

export class PriceError extends Error {}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Vermoegensverwaltung/1.0)" };

async function getJson(fetcher: Fetcher, url: string, headers: Record<string, string> = {}) {
  const res = await fetcher(url, { headers: { ...UA, ...headers }, cache: "no-store" });
  if (!res.ok) throw new PriceError(`Kursanbieter antwortet mit ${res.status}`);
  return res.json();
}

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/** Bevorzugte Börsen für Euro-Kurse, beste zuerst. */
const EUR_EXCHANGES = ["GER", "FRA", "AMS", "PAR", "MIL", "STU", "MUN", "DUS", "BER", "HAM", "VIE", "MCE"];

type YahooQuote = { symbol: string; exchange?: string; quoteType?: string };

/** Findet das Yahoo-Kürzel zu ISIN oder Ticker; bevorzugt deutsche/europäische Börsen. */
export async function resolveYahooSymbol(fetcher: Fetcher, identifier: string): Promise<string> {
  const q = identifier.trim().toUpperCase();
  const data = await getJson(fetcher, `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`);
  const quotes: YahooQuote[] = (data?.quotes ?? []).filter((x: YahooQuote) => x?.symbol);
  if (!quotes.length) {
    // Ein Ticker wie "AAPL" oder "VWCE.DE" funktioniert auch ohne Suchtreffer direkt.
    if (!ISIN.test(q)) return q;
    throw new PriceError(`Zu „${identifier}“ wurde kein Wertpapier gefunden`);
  }
  const ranked = [...quotes].sort((a, b) => rank(a) - rank(b));
  return ranked[0].symbol;
}

function rank(q: YahooQuote) {
  const i = EUR_EXCHANGES.indexOf(q.exchange ?? "");
  return i === -1 ? 100 : i;
}

async function yahooPrice(fetcher: Fetcher, symbol: string) {
  const data = await getJson(fetcher, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!meta || !Number.isFinite(price)) throw new PriceError(`Kein Kurs für ${symbol} verfügbar`);
  let currency = String(meta.currency ?? "EUR");
  let value = price;
  // Londoner Kurse kommen in Pence.
  if (currency === "GBp" || currency === "GBX") {
    currency = "GBP";
    value = price / 100;
  }
  return { price: value, currency };
}

/** Wechselkurs: 1 Einheit `currency` in Euro. */
export async function fxToEur(fetcher: Fetcher, currency: string): Promise<number> {
  if (currency === "EUR") return 1;
  const { price } = await yahooPrice(fetcher, `${currency}EUR=X`);
  return price;
}

export async function quoteSecurity(fetcher: Fetcher, identifier: string, cachedSymbol?: string | null): Promise<Quote> {
  const symbol = cachedSymbol && !cachedSymbol.startsWith("coingecko:") ? cachedSymbol : await resolveYahooSymbol(fetcher, identifier);
  const { price, currency } = await yahooPrice(fetcher, symbol);
  const fx = await fxToEur(fetcher, currency);
  return { symbol, price, currency, priceEur: price * fx };
}

/** Häufige Coin-Kürzel, damit keine Suche nötig ist. */
const COINS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOT: "polkadot",
  DOGE: "dogecoin",
  LTC: "litecoin",
  BNB: "binancecoin",
  USDT: "tether",
  USDC: "usd-coin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  TRX: "tron",
  XLM: "stellar",
  ATOM: "cosmos",
};

function cgHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

export async function resolveCoinId(fetcher: Fetcher, identifier: string): Promise<string> {
  const q = identifier.trim();
  const known = COINS[q.toUpperCase()];
  if (known) return known;
  const data = await getJson(fetcher, `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, cgHeaders());
  const coins: { id: string; symbol: string; market_cap_rank: number | null }[] = data?.coins ?? [];
  const exact = coins.filter((c) => c.symbol?.toUpperCase() === q.toUpperCase() || c.id === q.toLowerCase());
  const best = (exact.length ? exact : coins).sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9))[0];
  if (!best) throw new PriceError(`Coin „${identifier}“ nicht gefunden`);
  return best.id;
}

export async function quoteCrypto(fetcher: Fetcher, identifier: string, cachedSymbol?: string | null): Promise<Quote> {
  const id = cachedSymbol?.startsWith("coingecko:") ? cachedSymbol.slice(10) : await resolveCoinId(fetcher, identifier);
  const data = await getJson(fetcher, `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur`, cgHeaders());
  const price = Number(data?.[id]?.eur);
  if (!Number.isFinite(price)) throw new PriceError(`Kein Kurs für ${identifier} verfügbar`);
  return { symbol: `coingecko:${id}`, price, currency: "EUR", priceEur: price };
}
