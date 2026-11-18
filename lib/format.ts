const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pct = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" });

export const formatMoney = (n: number, currency = "EUR") =>
  currency === "EUR"
    ? eur.format(n)
    : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(n);
export const formatPercent = (n: number) => pct.format(n);
export const formatDate = (d: Date) => dateFmt.format(d);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Liest deutsche oder englische Zahlenschreibweise ("1.234,56" oder "1234.56"). */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s|€/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  // "8.500" oder "1.250.000" ohne Komma: Punkte sind Tausendertrennzeichen.
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
