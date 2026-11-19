import { cookies } from "next/headers";
import { cryptoHistory, RANGES, securityHistory, type History, type Range } from "@/lib/prices/history";
import { PriceError } from "@/lib/prices/providers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Kurze Zwischenspeicherung, damit Umschalten und Live-Aktualisierung die Anbieter nicht überlasten.
const cache = new Map<string, { at: number; data: History }>();
// Kurze Zeiträume ändern sich laufend, lange kaum.
const ttlMs = (range: Range) => (range === "1T" || range === "5T" ? 55_000 : range === "1M" || range === "3M" ? 2 * 60_000 : 5 * 60_000);

export async function GET(req: Request) {
  if (!(await verifySession((await cookies()).get(SESSION_COOKIE)?.value))) {
    return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const kind = url.searchParams.get("kind") === "crypto" ? "crypto" : "security";
  const range = (RANGES as readonly string[]).includes(url.searchParams.get("range") ?? "") ? (url.searchParams.get("range") as Range) : "1J";
  const symbol = url.searchParams.get("symbol");
  if (!q || q.length > 40) return Response.json({ error: "Bitte ISIN, Ticker oder Coin angeben" }, { status: 400 });

  const key = `${kind}|${(symbol ?? q).toUpperCase()}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs(range)) return Response.json(hit.data);

  try {
    const data = kind === "crypto" ? await cryptoHistory(fetch, q, range, symbol) : await securityHistory(fetch, q, range, symbol);
    if (!data.candles.length) return Response.json({ error: "Für diesen Zeitraum gibt es keine Kurse" }, { status: 404 });
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return Response.json(data);
  } catch (e) {
    const message = e instanceof PriceError ? e.message : "Kurse konnten nicht geladen werden";
    if (!(e instanceof PriceError)) console.error("Kursverlauf fehlgeschlagen", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
