import test from "node:test";
import assert from "node:assert/strict";
import { matchesQuery, facetOptions, applyFilters } from "../src/utils/filter.js";

const rows = [
  { name: "SW-Core", vlan: "10", mode: "ACCESS", vlans: ["10", "20"] },
  { name: "SW-Lab", vlan: "20", mode: "TRUNK", vlans: ["20"] },
  { name: "AP-Lobby", vlan: "10", mode: "ACCESS", vlans: [] },
];
const SEARCH = [(r) => r.name, (r) => r.vlan];

test("pencarian: semua kata harus cocok, tanpa beda huruf/aksen, hanya kolom yang tampil", () => {
  assert.ok(matchesQuery(rows[0], "sw core", SEARCH));
  assert.ok(matchesQuery(rows[0], "CORE 10", SEARCH));
  assert.ok(!matchesQuery(rows[0], "core 20", SEARCH));
  assert.ok(!matchesQuery(rows[0], "ACCESS", SEARCH), "mode tidak termasuk kolom pencarian di sini");
  assert.ok(matchesQuery(rows[0], "   ", SEARCH));
});

test("opsi filter dinamis: dihitung dari baris yang tampil, urut natural, nilai array dihitung per elemen", () => {
  const opts = facetOptions(rows, (r) => r.vlans);
  assert.deepEqual(opts.map((o) => [o.value, o.count]), [["10", 1], ["20", 2]]);
  const filtered = applyFilters(rows, { query: "", searchAccessors: SEARCH, filters: { mode: (r) => r.mode, vlan: (r) => r.vlan }, values: { mode: "ACCESS" } });
  assert.equal(filtered.length, 2);
  // opsi 'vlan' menghormati filter lain (mode=ACCESS) tapi tidak dirinya sendiri
  const base = applyFilters(rows, { query: "", searchAccessors: SEARCH, filters: { mode: (r) => r.mode, vlan: (r) => r.vlan }, values: { mode: "ACCESS", vlan: "20" }, except: "vlan" });
  assert.deepEqual(facetOptions(base, (r) => r.vlan).map((o) => o.value), ["10"]);
});
