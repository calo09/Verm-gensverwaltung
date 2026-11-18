import { z } from "zod";

/**
 * Wie eine CSV-Datei gelesen wird. Wird pro Bank/Broker als Profil gespeichert.
 *
 * Drei Arten von Dateien:
 * - BALANCE: jede Zeile hat Datum und Kontostand → ein Wert pro Tag für eine Position.
 * - TRANSACTIONS: jede Zeile ist eine Buchung (Datum, Betrag). Mit dem aktuellen Kontostand
 *   wird rückwärts der Stand an jedem Tag berechnet.
 * - HOLDINGS: Depot- oder Bestandsübersicht. Jede Zeile ist eine Position mit Wert,
 *   alle zum selben Stichtag.
 */
export const importConfigSchema = z.object({
  mode: z.enum(["BALANCE", "TRANSACTIONS", "HOLDINGS"]),
  encoding: z.enum(["utf-8", "windows-1252"]).default("utf-8"),
  delimiter: z.enum([";", ",", "\t"]).default(";"),
  decimal: z.enum(["comma", "dot"]).default("comma"),
  dateFormat: z.enum(["DD.MM.YYYY", "DD.MM.YY", "YYYY-MM-DD", "MM/DD/YYYY"]).default("DD.MM.YYYY"),
  /** Anzahl Zeilen vor der Kopfzeile, die übersprungen werden (manche Banken schreiben Kontoinfos davor). */
  skipRows: z.number().int().min(0).max(50).default(0),
  columns: z.object({
    date: z.string().optional(),
    amount: z.string().optional(),
    name: z.string().optional(),
    identifier: z.string().optional(),
  }),
});

export type ImportConfig = z.infer<typeof importConfigSchema>;

export const MODE_LABELS: Record<ImportConfig["mode"], string> = {
  BALANCE: "Kontostand je Tag",
  TRANSACTIONS: "Umsätze / Buchungen",
  HOLDINGS: "Depot- oder Bestandsübersicht",
};

/** Welche Spalten je Art gebraucht werden. */
export const REQUIRED_COLUMNS: Record<ImportConfig["mode"], (keyof ImportConfig["columns"])[]> = {
  BALANCE: ["date", "amount"],
  TRANSACTIONS: ["date", "amount"],
  HOLDINGS: ["name", "amount"],
};

export const COLUMN_LABELS: Record<keyof ImportConfig["columns"], string> = {
  date: "Datum",
  amount: "Betrag / Wert",
  name: "Bezeichnung",
  identifier: "Kennung (ISIN, Ticker)",
};

/** Zerlegt CSV-Text in Zeilen und Felder; versteht Anführungszeichen und Zeilenumbrüche in Feldern. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Rät das Trennzeichen anhand der ersten Zeilen. */
export function detectDelimiter(text: string): ImportConfig["delimiter"] {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const counts = ([";", ",", "\t"] as const).map((d) => [d, sample.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseNumber(raw: string, decimal: ImportConfig["decimal"]): number | null {
  let s = raw.trim().replace(/[\s€$£]|EUR|USD/g, "");
  if (!s) return null;
  // "1.234,56-" (nachgestelltes Minus) kommt bei manchen Banken vor.
  let negative = false;
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = decimal === "comma" ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Liefert ISO-Datum (YYYY-MM-DD) oder null. */
export function parseDate(raw: string, format: ImportConfig["dateFormat"]): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if (format === "YYYY-MM-DD" && (match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if (format === "DD.MM.YYYY" && (match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if (format === "DD.MM.YY" && (match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})(?!\d)/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), 2000 + Number(match[3])];
  } else if (format === "MM/DD/YYYY" && (match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export type Table = { headers: string[]; rows: string[][] };

export function toTable(text: string, config: Pick<ImportConfig, "delimiter" | "skipRows">): Table {
  const all = parseCsv(text, config.delimiter).slice(config.skipRows);
  const [headers = [], ...rows] = all;
  return { headers: headers.map((h) => h.trim()), rows };
}

export type RowIssue = { row: number; message: string };

export type DatedValue = { date: string; value: number };
export type Holding = { name: string; identifier: string | null; value: number };

export type ImportResult =
  | { mode: "BALANCE" | "TRANSACTIONS"; values: DatedValue[]; issues: RowIssue[]; usedRows: number }
  | { mode: "HOLDINGS"; holdings: Holding[]; issues: RowIssue[]; usedRows: number };

function col(table: Table, name: string | undefined) {
  if (!name) return -1;
  return table.headers.indexOf(name);
}

/**
 * Wandelt die Tabelle anhand des Profils in Werte um.
 * `endBalance` wird nur für TRANSACTIONS gebraucht: der Kontostand nach der letzten Buchung.
 */
export function interpret(table: Table, config: ImportConfig, endBalance?: number): ImportResult {
  const issues: RowIssue[] = [];
  const missing = REQUIRED_COLUMNS[config.mode].filter((c) => col(table, config.columns[c]) < 0);
  if (missing.length) {
    const names = missing.map((c) => COLUMN_LABELS[c]).join(", ");
    return config.mode === "HOLDINGS"
      ? { mode: "HOLDINGS", holdings: [], issues: [{ row: 0, message: `Spalte fehlt: ${names}` }], usedRows: 0 }
      : { mode: config.mode, values: [], issues: [{ row: 0, message: `Spalte fehlt: ${names}` }], usedRows: 0 };
  }
  const amountIdx = col(table, config.columns.amount);
  // Zeilennummern wie in der Datei (Kopfzeile + übersprungene Zeilen + 1-basiert).
  const lineNo = (i: number) => config.skipRows + i + 2;

  if (config.mode === "HOLDINGS") {
    const nameIdx = col(table, config.columns.name);
    const idIdx = col(table, config.columns.identifier);
    const holdings: Holding[] = [];
    table.rows.forEach((r, i) => {
      const name = (r[nameIdx] ?? "").trim();
      const value = parseNumber(r[amountIdx] ?? "", config.decimal);
      if (!name) return; // Summenzeilen o. Ä. ohne Namen still überspringen
      if (value === null) return issues.push({ row: lineNo(i), message: `Betrag „${r[amountIdx] ?? ""}“ nicht lesbar` });
      holdings.push({ name, identifier: idIdx >= 0 ? (r[idIdx] ?? "").trim() || null : null, value });
    });
    return { mode: "HOLDINGS", holdings, issues, usedRows: holdings.length };
  }

  const dateIdx = col(table, config.columns.date);
  const entries: { date: string; amount: number; order: number }[] = [];
  table.rows.forEach((r, i) => {
    const date = parseDate(r[dateIdx] ?? "", config.dateFormat);
    const amount = parseNumber(r[amountIdx] ?? "", config.decimal);
    if (!date) return issues.push({ row: lineNo(i), message: `Datum „${r[dateIdx] ?? ""}“ passt nicht zum Format ${config.dateFormat}` });
    if (amount === null) return issues.push({ row: lineNo(i), message: `Betrag „${r[amountIdx] ?? ""}“ nicht lesbar` });
    entries.push({ date, amount, order: i });
  });
  if (!entries.length) return { mode: config.mode, values: [], issues, usedRows: 0 };

  // Banken exportieren mal neueste, mal älteste Buchung zuerst. In Dateireihenfolge chronologisch machen.
  const descending = entries[0].date > entries[entries.length - 1].date;
  const chrono = descending ? [...entries].reverse() : entries;

  if (config.mode === "BALANCE") {
    // Pro Tag zählt der Stand nach der letzten Buchung des Tages.
    const byDay = new Map<string, number>();
    for (const e of chrono) byDay.set(e.date, e.amount);
    const values = [...byDay].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
    return { mode: "BALANCE", values, issues, usedRows: entries.length };
  }

  // TRANSACTIONS: vom Endstand rückwärts rechnen, in Cent gegen Rundungsfehler.
  if (endBalance === undefined) {
    return { mode: "TRANSACTIONS", values: [], issues: [...issues, { row: 0, message: "Aktueller Kontostand fehlt" }], usedRows: 0 };
  }
  const sums = new Map<string, number>();
  for (const e of chrono) sums.set(e.date, (sums.get(e.date) ?? 0) + Math.round(e.amount * 100));
  const days = [...sums.keys()].sort();
  let balance = Math.round(endBalance * 100);
  const values: DatedValue[] = [];
  for (let i = days.length - 1; i >= 0; i--) {
    values.push({ date: days[i], value: balance / 100 });
    balance -= sums.get(days[i])!;
  }
  return { mode: "TRANSACTIONS", values: values.reverse(), issues, usedRows: entries.length };
}

/** Schlägt Spalten anhand üblicher Überschriften vor. */
export function guessColumns(headers: string[], mode: ImportConfig["mode"]): ImportConfig["columns"] {
  const find = (...patterns: RegExp[]) => headers.find((h) => patterns.some((p) => p.test(h)));
  return {
    date: find(/buchungstag/i, /buchungsdatum/i, /^datum$/i, /valuta/i, /date/i, /datum/i),
    amount:
      mode === "BALANCE"
        ? find(/saldo/i, /kontostand/i, /balance/i)
        : mode === "TRANSACTIONS"
          ? find(/^betrag/i, /umsatz/i, /amount/i, /betrag/i)
          : find(/kurswert/i, /marktwert/i, /^wert/i, /value/i, /betrag/i),
    name: find(/bezeichnung/i, /^name$/i, /wertpapier/i, /instrument/i, /titel/i),
    identifier: find(/isin/i, /wkn/i, /ticker/i, /symbol/i),
  };
}
