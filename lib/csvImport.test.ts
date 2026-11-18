import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDelimiter, guessColumns, interpret, parseCsv, parseDate, parseNumber, toTable, type ImportConfig } from "./csvImport.ts";

const base = { encoding: "utf-8", delimiter: ";", decimal: "comma", dateFormat: "DD.MM.YYYY", skipRows: 0 } as const;

test("parseCsv versteht Anführungszeichen, Trennzeichen im Feld und CRLF", () => {
  const rows = parseCsv('﻿a;"b;c";"d ""x"""\r\n1;2;3\r\n\r\n', ";");
  assert.deepEqual(rows, [["a", "b;c", 'd "x"'], ["1", "2", "3"]]);
});

test("detectDelimiter", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
});

test("parseNumber und parseDate", () => {
  assert.equal(parseNumber("-1.234,56", "comma"), -1234.56);
  assert.equal(parseNumber("1.234,56-", "comma"), -1234.56);
  assert.equal(parseNumber("1,234.56 EUR", "dot"), 1234.56);
  assert.equal(parseNumber("", "comma"), null);
  assert.equal(parseDate("05.03.2026", "DD.MM.YYYY"), "2026-03-05");
  assert.equal(parseDate("5.3.26", "DD.MM.YY"), "2026-03-05");
  assert.equal(parseDate("2026-03-05T10:00", "YYYY-MM-DD"), "2026-03-05");
  assert.equal(parseDate("03/05/2026", "MM/DD/YYYY"), "2026-03-05");
  assert.equal(parseDate("31.02.2026", "DD.MM.YYYY"), null);
});

test("BALANCE: neueste Zeile zuerst, pro Tag gilt der Stand nach der letzten Buchung", () => {
  const csv = "Kontoinfo;x\nBuchungstag;Text;Saldo\n03.01.2026;B;150,00\n03.01.2026;A;120,00\n01.01.2026;Start;100,00\n";
  const config: ImportConfig = { ...base, skipRows: 1, mode: "BALANCE", columns: { date: "Buchungstag", amount: "Saldo" } };
  const r = interpret(toTable(csv, config), config);
  assert.equal(r.mode, "BALANCE");
  if ("values" in r) assert.deepEqual(r.values, [{ date: "2026-01-01", value: 100 }, { date: "2026-01-03", value: 150 }]);
});

test("TRANSACTIONS: rechnet vom Endstand rückwärts", () => {
  const csv = "Datum;Betrag\n01.01.2026;-10,50\n01.01.2026;100,00\n05.01.2026;-20,00\n09.01.2026;0,10\nkaputt;1\n";
  const config: ImportConfig = { ...base, mode: "TRANSACTIONS", columns: { date: "Datum", amount: "Betrag" } };
  const r = interpret(toTable(csv, config), config, 1000);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].row, 6);
  if ("values" in r)
    assert.deepEqual(r.values, [
      { date: "2026-01-01", value: 1019.9 },
      { date: "2026-01-05", value: 999.9 },
      { date: "2026-01-09", value: 1000 },
    ]);
});

test("HOLDINGS: Depotübersicht, Summenzeile ohne Namen wird übersprungen", () => {
  const csv = "Bezeichnung,ISIN,Kurswert\nMSCI World,IE00B4L5Y983,\"1,234.50\"\n,,1234.50\n";
  const config: ImportConfig = { ...base, delimiter: ",", decimal: "dot", mode: "HOLDINGS", columns: { name: "Bezeichnung", identifier: "ISIN", amount: "Kurswert" } };
  const r = interpret(toTable(csv, config), config);
  assert.equal(r.mode, "HOLDINGS");
  if (r.mode === "HOLDINGS") assert.deepEqual(r.holdings, [{ name: "MSCI World", identifier: "IE00B4L5Y983", value: 1234.5 }]);
});

test("fehlende Spalte wird gemeldet", () => {
  const config: ImportConfig = { ...base, mode: "BALANCE", columns: { date: "Datum", amount: "Saldo" } };
  const r = interpret(toTable("Datum;Betrag\n01.01.2026;1", config), config);
  assert.match(r.issues[0].message, /Betrag \/ Wert/);
});

test("guessColumns erkennt typische Überschriften", () => {
  assert.deepEqual(guessColumns(["Buchungstag", "Valutadatum", "Betrag", "Saldo"], "BALANCE"), {
    date: "Buchungstag", amount: "Saldo", name: undefined, identifier: undefined,
  });
  assert.equal(guessColumns(["Datum", "Betrag (EUR)"], "TRANSACTIONS").amount, "Betrag (EUR)");
});
