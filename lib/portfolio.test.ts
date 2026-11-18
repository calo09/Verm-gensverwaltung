import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, netAt, type AssetInput } from "./portfolio.ts";

const data: AssetInput[] = [
  {
    id: "a",
    name: "Giro",
    type: "GIROKONTO",
    institution: "Sparkasse",
    valuations: [
      { date: "2026-01-01", value: 1000.1 },
      { date: "2026-03-01", value: 1500.2 },
    ],
  },
  {
    id: "b",
    name: "ETF",
    type: "DEPOT",
    institution: "Trade Republic",
    valuations: [{ date: "2026-02-01", value: 5000 }],
  },
  {
    id: "c",
    name: "Autokredit",
    type: "KREDIT",
    institution: "Sparkasse",
    valuations: [{ date: "2026-01-15", value: 2000 }],
  },
  { id: "d", name: "Leer", type: "SONSTIGES", institution: null, valuations: [] },
];

test("aktuelle Summen ziehen Schulden ab", () => {
  const s = summarize(data, "2026-11-18");
  assert.equal(s.assets, 6500.2);
  assert.equal(s.liabilities, 2000);
  assert.equal(s.net, 4500.2);
  assert.deepEqual(
    s.byInstitution.find((e) => e.institution === "Sparkasse"),
    { institution: "Sparkasse", value: -499.8 },
  );
});

test("Verlauf übernimmt den letzten bekannten Wert je Position", () => {
  const s = summarize(data, "2026-11-18");
  assert.deepEqual(s.history, [
    { date: "2026-01-01", net: 1000.1 },
    { date: "2026-01-15", net: -999.9 },
    { date: "2026-02-01", net: 4000.1 },
    { date: "2026-03-01", net: 4500.2 },
  ]);
  assert.equal(netAt(s.history, "2026-02-15"), 4000.1);
  assert.equal(netAt(s.history, "2025-12-31"), null);
});

test("Werte in der Zukunft zählen noch nicht", () => {
  const s = summarize(data, "2026-02-10");
  assert.equal(s.net, 4000.1);
  assert.equal(s.history.length, 3);
});
