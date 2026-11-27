// Jalankan: node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import { sortRows, ipSortKey, prefixNumber } from "../src/utils/sort.js";

const names = (rows) => rows.map((r) => r.n);

test("A-Z natural: AP-2 sebelum AP-10, huruf besar/kecil sama", () => {
  const rows = [{ n: "AP-10" }, { n: "ap-2" }, { n: "AP-1" }];
  const acc = { n: (r) => r.n };
  assert.deepEqual(names(sortRows(rows, { key: "n", dir: "asc" }, acc)), ["AP-1", "ap-2", "AP-10"]);
  assert.deepEqual(names(sortRows(rows, { key: "n", dir: "desc" }, acc)), ["AP-10", "ap-2", "AP-1"]);
});

test("nilai kosong selalu di akhir (asc maupun desc)", () => {
  const rows = [{ n: null }, { n: "b" }, { n: "" }, { n: "a" }];
  const acc = { n: (r) => r.n };
  assert.deepEqual(names(sortRows(rows, { key: "n", dir: "asc" }, acc)).slice(0, 2), ["a", "b"]);
  assert.deepEqual(names(sortRows(rows, { key: "n", dir: "desc" }, acc)).slice(0, 2), ["b", "a"]);
});

test("angka dibandingkan sebagai angka, IP per oktet, prefix numerik", () => {
  const rows = [{ n: 10 }, { n: 9 }, { n: 100 }];
  assert.deepEqual(names(sortRows(rows, { key: "n", dir: "asc" }, { n: (r) => r.n })), [9, 10, 100]);
  const ips = [{ n: "10.0.0.10" }, { n: "10.0.0.2" }, { n: "9.9.9.9" }];
  assert.deepEqual(names(sortRows(ips, { key: "n", dir: "asc" }, { n: (r) => ipSortKey(r.n) })), ["9.9.9.9", "10.0.0.2", "10.0.0.10"]);
  assert.equal(prefixNumber("/24"), 24);
  assert.equal(prefixNumber(null), null);
});

test("tanpa sort: urutan asli; stabil untuk nilai sama; input tidak dimutasi", () => {
  const rows = [{ n: "x", i: 1 }, { n: "x", i: 2 }, { n: "a", i: 3 }];
  const copy = [...rows];
  assert.equal(sortRows(rows, null, { n: (r) => r.n }), rows);
  const out = sortRows(rows, { key: "n", dir: "asc" }, { n: (r) => r.n });
  assert.deepEqual(out.map((r) => r.i), [3, 1, 2]);
  assert.deepEqual(rows, copy);
});
