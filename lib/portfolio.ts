import { isLiability, type AssetTypeKey } from "./assetTypes.ts";

export type AssetInput = {
  id: string;
  name: string;
  type: AssetTypeKey;
  institution: string | null;
  /** Bewertungen mit ISO-Datum (YYYY-MM-DD) und positivem Betrag in Euro. */
  valuations: { date: string; value: number }[];
};

export type PositionSummary = {
  id: string;
  name: string;
  type: AssetTypeKey;
  institution: string | null;
  /** Vorzeichenbehafteter aktueller Wert (Schulden negativ). */
  value: number;
  lastDate: string | null;
};

export type Summary = {
  net: number;
  assets: number;
  liabilities: number;
  positions: PositionSummary[];
  byType: { type: AssetTypeKey; value: number }[];
  byInstitution: { institution: string; value: number }[];
  history: { date: string; net: number }[];
};

// Gerechnet wird in Cent, damit sich keine Rundungsfehler aufsummieren.
const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

function latestUpTo(valuations: AssetInput["valuations"], date: string) {
  let best: { date: string; value: number } | null = null;
  for (const v of valuations) {
    if (v.date <= date && (!best || v.date > best.date)) best = v;
  }
  return best;
}

export function summarize(input: AssetInput[], today: string): Summary {
  let assetsC = 0;
  let liabilitiesC = 0;
  const byType = new Map<AssetTypeKey, number>();
  const byInst = new Map<string, number>();

  const positions: PositionSummary[] = input.map((a) => {
    const latest = latestUpTo(a.valuations, today);
    const cents = latest ? toCents(latest.value) : 0;
    const liability = isLiability(a.type);
    if (liability) liabilitiesC += cents;
    else assetsC += cents;
    const signed = liability ? -cents : cents;
    byType.set(a.type, (byType.get(a.type) ?? 0) + signed);
    const inst = a.institution?.trim() || "Ohne Institut";
    byInst.set(inst, (byInst.get(inst) ?? 0) + signed);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      value: fromCents(signed),
      lastDate: latest?.date ?? null,
    };
  });

  // Verlauf: an jedem Datum, an dem sich irgendein Wert geändert hat, gilt je Position der letzte bekannte Wert.
  const dates = [...new Set(input.flatMap((a) => a.valuations.map((v) => v.date)))]
    .filter((d) => d <= today)
    .sort();
  const history = dates.map((date) => {
    let netC = 0;
    for (const a of input) {
      const v = latestUpTo(a.valuations, date);
      if (!v) continue;
      netC += isLiability(a.type) ? -toCents(v.value) : toCents(v.value);
    }
    return { date, net: fromCents(netC) };
  });

  return {
    net: fromCents(assetsC - liabilitiesC),
    assets: fromCents(assetsC),
    liabilities: fromCents(liabilitiesC),
    positions: positions.sort((x, y) => Math.abs(y.value) - Math.abs(x.value)),
    byType: [...byType].map(([type, c]) => ({ type, value: fromCents(c) })).filter((e) => e.value !== 0),
    byInstitution: [...byInst]
      .map(([institution, c]) => ({ institution, value: fromCents(c) }))
      .filter((e) => e.value !== 0),
    history,
  };
}

/** Nettovermögen zum letzten Verlaufspunkt an oder vor `date` (für "seit Vormonat" usw.). */
export function netAt(history: Summary["history"], date: string): number | null {
  let found: number | null = null;
  for (const p of history) if (p.date <= date) found = p.net;
  return found;
}
