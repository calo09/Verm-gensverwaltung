import { test } from "node:test";
import assert from "node:assert/strict";
import { bollinger, ema, rsi, sma } from "./indicators.ts";

const pts = (vals: number[]) => vals.map((value, i) => ({ time: i, value }));
const round = (xs: { value: number }[]) => xs.map((x) => Math.round(x.value * 1000) / 1000);

test("SMA", () => {
  assert.deepEqual(sma(pts([1, 2, 3, 4, 5]), 3), [{ time: 2, value: 2 }, { time: 3, value: 3 }, { time: 4, value: 4 }]);
  assert.deepEqual(sma(pts([1, 2]), 3), []);
});

test("EMA startet mit dem SMA", () => {
  assert.deepEqual(round(ema(pts([2, 4, 6, 8]), 3)), [4, 6]);
});

test("RSI: nur steigend = 100, nur fallend = 0, Lehrbuchbeispiel", () => {
  assert.equal(rsi(pts([1, 2, 3, 4, 5, 6]), 3).at(-1)!.value, 100);
  assert.equal(rsi(pts([6, 5, 4, 3, 2, 1]), 3).at(-1)!.value, 0);
  // Wilder-Beispiel (14 Perioden), erster RSI ≈ 70,46
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
  assert.equal(Math.round(rsi(pts(closes), 14)[0].value * 100) / 100, 70.46);
});

test("Bollinger bei konstantem Kurs fallen auf den Mittelwert zusammen", () => {
  const b = bollinger(pts([5, 5, 5, 5]), 2);
  assert.deepEqual(round(b.upper), [5, 5, 5]);
  assert.deepEqual(round(b.lower), [5, 5, 5]);
});
