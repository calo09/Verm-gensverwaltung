import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "./format.ts";

test("parseAmount versteht deutsche und englische Schreibweise", () => {
  assert.equal(parseAmount("2.400,50"), 2400.5);
  assert.equal(parseAmount("8.500"), 8500);
  assert.equal(parseAmount("1.250.000"), 1250000);
  assert.equal(parseAmount("1234.56"), 1234.56);
  assert.equal(parseAmount("12,5 €"), 12.5);
  assert.equal(parseAmount("0.5"), 0.5);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});
