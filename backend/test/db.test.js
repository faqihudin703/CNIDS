// Tes lapisan database/service (tanpa MySQL: Prisma di-stub). Jalankan: npm test
process.env.NODE_ENV = "production";
process.env.DATABASE_URL = "mysql://u:p@localhost:3306/test";
process.env.MONITOR_CONCURRENCY = "10";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- stub ping + prisma yang bisa diganti per tes ---------------------------------------------
const pingStats = { cur: 0, max: 0, calls: 0, events: [], alive: true };
const pingStub = {
  promise: {
    probe: async (ip) => {
      pingStats.calls++;
      pingStats.cur++;
      pingStats.max = Math.max(pingStats.max, pingStats.cur);
      pingStats.events.push(["ping_start", ip]);
      await sleep(15);
      pingStats.cur--;
      pingStats.events.push(["ping_end", ip]);
      return { alive: pingStats.alive, time: "12" };
    },
  },
};
let prismaImpl = {};
const prismaProxy = new Proxy({}, { get: (_, k) => prismaImpl[k] });
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "ping") return pingStub;
  if (/config\/prisma$/.test(request)) return prismaProxy;
  return origLoad.call(this, request, parent, ...rest);
};

const { mapWithConcurrency } = require("../src/utils/concurrency");
const { parsePagination } = require("../src/utils/pagination");
const { resolveUpload } = require("../src/utils/fileStore");
const { areaWithDescendants, isDescendant } = require("../src/utils/areaTree");
const { createBuildingSchema, updateBuildingSchema } = require("../src/utils/validators/buildingValidators");
const { loadDevice } = require("../src/middleware/loadDevice");
const { deleteInBatches, purgeStaleData } = require("../src/services/maintenance");
const { getAlertCounts } = require("../src/services/alertService");
const { getMonitoringSummary } = require("../src/services/dashboardService");
const { cleanupOrphanPools } = require("../src/services/poolService");
const portService = require("../src/services/portService");
const monitoring = require("../src/services/monitoringService");

test("mapWithConcurrency: batas konkurensi dipatuhi, urutan hasil dijaga, kegagalan terisolasi", async () => {
  let cur = 0, max = 0;
  const res = await mapWithConcurrency([...Array(40).keys()], 5, async (n) => {
    cur++; max = Math.max(max, cur);
    await sleep(3);
    cur--;
    if (n === 7) throw new Error("boom");
    return n * 2;
  });
  assert.ok(max <= 5, `konkurensi ${max} > 5`);
  assert.equal(res.length, 40);
  assert.equal(res[7].status, "rejected");
  assert.deepEqual(res.filter((r) => r.status === "fulfilled").map((r) => r.value).slice(0, 3), [0, 2, 4]);
  assert.deepEqual(await mapWithConcurrency([], 5, async () => 1), []);
});

test("paginasi: nilai ngawai dibatasi", () => {
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 25, skip: 0, take: 25 });
  const p = parsePagination({ page: "-5", pageSize: "100000" });
  assert.equal(p.page, 1); assert.equal(p.pageSize, 100);
  assert.equal(parsePagination({ page: "99999999999", pageSize: "10" }).page, 100000);
  assert.equal(parsePagination({ page: "abc", pageSize: "x" }).pageSize, 25);
  assert.equal(parsePagination({ pageSize: "9999" }, { maxSize: 500 }).pageSize, 500);
});

test("monitoring: seluruh perangkat dicek dengan ≤10 ping bersamaan, penulisan HANYA lewat transaksi", async () => {
  const devices = [...Array(35).keys()].map((i) => ({ id: i + 1, name: "D" + i, ipAddress: `10.0.0.${i + 1}`, monitorMethod: "ICMP" }));
  const log = { tx: 0, maxTx: 0, curTx: 0, ops: [], txStartAfterPing: true };
  const rootWrite = (n) => () => { throw new Error("tulis di luar transaksi: " + n); };
  prismaImpl = {
    device: { findMany: async () => devices, update: rootWrite("device.update") },
    statusCheck: { create: rootWrite("statusCheck.create") },
    deviceAlert: { createMany: rootWrite("alert.createMany"), updateMany: rootWrite("alert.updateMany"), findMany: rootWrite("alert.findMany") },
    deviceHistory: { create: rootWrite("history.create") },
    $transaction: async (fn) => {
      log.tx++; log.curTx++; log.maxTx = Math.max(log.maxTx, log.curTx);
      const lastEnd = pingStats.events.filter((e) => e[0] === "ping_end").length;
      if (lastEnd === 0) log.txStartAfterPing = false; // transaksi tidak boleh dibuka sebelum ada ping selesai
      const tx = {
        device: { update: async ({ data }) => { log.ops.push("device.update"); return { monitorMethod: "ICMP", onlineStatus: "ON", lastOnlineAt: new Date(), offlineSince: null, ...("lastCheckedAt" in data ? {} : {}) }; } },
        statusCheck: { create: async ({ data }) => { log.ops.push("statusCheck.create"); return { id: 1, ...data }; } },
        deviceAlert: {
          findMany: async () => [],
          createMany: async ({ data }) => { log.ops.push("alert.createMany:" + data.map((d) => d.type)); return { count: data.length }; },
          updateMany: async () => ({ count: 0 }),
        },
        deviceHistory: { create: async () => { log.ops.push("history.create"); return {}; } },
      };
      try { return await fn(tx); } finally { log.curTx--; }
    },
  };
  pingStats.alive = false; // semua DOWN, perangkat pernah On -> OFFLINE + transisi ON->OFF

  const r = await monitoring.runAllChecks();
  assert.equal(r.skipped, false); assert.equal(r.total, 35); assert.equal(r.failed, 0);
  assert.ok(pingStats.max <= 10, `ping bersamaan ${pingStats.max}`);
  assert.ok(pingStats.max > 1, "ping seharusnya paralel");
  assert.equal(log.tx, 35);
  assert.ok(log.maxTx <= 10);
  assert.ok(log.txStartAfterPing, "transaksi dibuka sebelum ping selesai (koneksi DB tertahan)");
  assert.equal(log.ops.filter((o) => o === "statusCheck.create").length, 35);
  assert.equal(log.ops.filter((o) => o === "alert.createMany:OFFLINE").length, 35);
  assert.equal(log.ops.filter((o) => o === "history.create").length, 35);
});

test("monitoring: putaran yang tumpang tindih dilewati; kegagalan satu perangkat tidak menghentikan yang lain", async () => {
  const devices = [1, 2, 3].map((i) => ({ id: i, name: "D" + i, ipAddress: "10.1.0." + i, monitorMethod: "ICMP" }));
  prismaImpl = {
    device: { findMany: async () => devices },
    $transaction: async (fn) => fn({
      device: { update: async ({ where }) => { if (where.id === 2) throw new Error("db down"); return { monitorMethod: "ICMP", onlineStatus: "ON", lastOnlineAt: new Date() }; } },
      statusCheck: { create: async (a) => a.data },
      deviceAlert: { findMany: async () => [], createMany: async () => ({}), updateMany: async () => ({}) },
      deviceHistory: { create: async () => ({}) },
    }),
  };
  pingStats.alive = true;
  const first = monitoring.runAllChecks();
  const second = await monitoring.runAllChecks(); // dipanggil saat yang pertama masih berjalan
  assert.equal(second.skipped, true);
  const r = await first;
  assert.equal(r.total, 3); assert.equal(r.failed, 1);
  assert.equal((await monitoring.runAllChecks()).skipped, false); // kunci dilepas setelah selesai
});

test("monitoring: perangkat tanpa IP tidak di-ping dan status tidak berubah (UNKNOWN)", async () => {
  const before = pingStats.calls;
  let changes;
  prismaImpl = {
    $transaction: async (fn) => fn({
      device: { update: async ({ data }) => { changes = data; return { monitorMethod: "ICMP", onlineStatus: "ON", lastOnlineAt: new Date() }; } },
      statusCheck: { create: async (a) => a.data },
      deviceAlert: { findMany: async () => [], createMany: async () => ({}), updateMany: async () => ({}) },
      deviceHistory: { create: async () => ({}) },
    }),
  };
  await monitoring.runCheckForDevice({ id: 9, ipAddress: null, monitorMethod: "ICMP" });
  assert.equal(pingStats.calls, before);
  assert.ok(!("onlineStatus" in changes));
});

test("dashboard: ringkasan monitoring dihitung dari kolom perangkat, tanpa memuat status_checks", async () => {
  prismaImpl = {
    statusCheck: { findMany: () => { throw new Error("tidak boleh memuat riwayat ping"); } },
    device: {
      count: async () => 10,
      groupBy: async () => [{ onlineStatus: "ON", _count: { _all: 5 } }, { onlineStatus: "OFF", _count: { _all: 2 } }, { onlineStatus: "NEVER_ON", _count: { _all: 1 } }],
      findMany: async ({ take, where }) => { assert.equal(take, 5); assert.deepEqual(where.onlineStatus.in, ["OFF", "NEVER_ON"]); return [{ id: 1, name: "A", ipAddress: "1.1.1.1" }]; },
    },
  };
  const s = await getMonitoringSummary();
  assert.deepEqual({ t: s.total, u: s.up, d: s.down, k: s.unknown }, { t: 10, u: 5, d: 3, k: 2 });
  assert.equal(s.downDevices.length, 1);
});

test("jumlah peringatan: satu query groupBy menggantikan 2–4 query count", async () => {
  let calls = 0;
  prismaImpl = { deviceAlert: { groupBy: async () => { calls++; return [
    { status: "ACTIVE", severity: "CRITICAL", _count: { _all: 3 } },
    { status: "ACTIVE", severity: "WARNING", _count: { _all: 2 } },
    { status: "ACKNOWLEDGED", severity: "CRITICAL", _count: { _all: 4 } },
    { status: "RESOLVED", severity: "CRITICAL", _count: { _all: 9 } },
  ]; } } };
  const c = await getAlertCounts();
  assert.equal(calls, 1);
  assert.deepEqual(c, { active: 5, acknowledged: 4, resolved: 9, critical: 7, activeCritical: 3, open: 9 });
});

test("retensi: penghapusan bertahap dan memakai batas hari dari env", async () => {
  const rows = [...Array(12000).keys()].map((i) => ({ id: i }));
  let deleteCalls = 0;
  const model = {
    findMany: async ({ take }) => rows.slice(0, take),
    deleteMany: async ({ where }) => { deleteCalls++; const ids = new Set(where.id.in); const keep = rows.filter((r) => !ids.has(r.id)); const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
  };
  assert.equal(await deleteInBatches(model, {}), 12000);
  assert.equal(deleteCalls, 3);

  const seen = {};
  const spy = (name) => ({ findMany: async ({ where }) => { seen[name] = where; return []; }, deleteMany: async () => ({ count: 0 }) });
  process.env.STATUS_RETENTION_DAYS = "7";
  const now = Date.UTC(2026, 10, 3);
  await purgeStaleData({ statusCheck: spy("sc"), deviceAlert: spy("al"), session: spy("se") }, now);
  assert.equal(seen.sc.checkedAt.lt.getTime(), now - 7 * 86400000);
  assert.equal(seen.al.status, "RESOLVED");
  assert.equal(seen.al.resolvedAt.lt.getTime(), now - 180 * 86400000);
  assert.equal(seen.se.expiresAt.lt.getTime(), now);
  delete process.env.STATUS_RETENTION_DAYS;
});

test("pool IP: pembersihan pool yatim melewati pool yang baru dibuat (anti balapan)", async () => {
  let where;
  await cleanupOrphanPools({ ipPool: { deleteMany: async (a) => { where = a.where; return { count: 0 }; } } });
  assert.deepEqual(where.ports, { none: {} });
  const age = Date.now() - where.createdAt.lt.getTime();
  assert.ok(age >= 59_000 && age <= 62_000, `grace ${age}ms`);
});

test("port massal: satu upsert per pool UNIK dan semuanya di dalam transaksi", async () => {
  const ops = { upsert: 0, createMany: 0, root: 0 };
  const tx = {
    ipPool: { upsert: async () => { ops.upsert++; return { id: ops.upsert }; }, deleteMany: async () => ({ count: 0 }) },
    devicePort: { createMany: async ({ data }) => { ops.createMany++; return { count: data.length }; } },
  };
  prismaImpl = {
    $transaction: async (fn) => fn(tx),
    ipPool: { upsert: () => { ops.root++; } },
    devicePort: { createMany: () => { ops.root++; } },
  };
  const ports = [];
  for (let i = 1; i <= 60; i++) ports.push({ interfaceName: "Vlan" + i, portMode: "ACCESS", vlan: String(i), ipInterface: `192.168.${i % 3}.${i}`, prefix: "/24" });
  const created = await portService.bulkCreatePorts(1, ports);
  assert.equal(created, 60);
  assert.equal(ops.upsert, 3); // 192.168.0/1/2.0 saja, bukan 60
  assert.equal(ops.createMany, 1);
  assert.equal(ops.root, 0);
});

test("pohon area: turunan & deteksi siklus dengan satu query", async () => {
  let queries = 0;
  const db = { building: { findMany: async () => { queries++; return [
    { id: 1, parentId: null }, { id: 2, parentId: 1 }, { id: 3, parentId: 2 }, { id: 4, parentId: 1 }, { id: 5, parentId: null },
  ]; } } };
  assert.deepEqual((await areaWithDescendants(1, db)).sort(), [1, 2, 3, 4]);
  assert.deepEqual(await areaWithDescendants(5, db), [5]);
  assert.equal(queries, 2);
  assert.equal(await isDescendant(3, 1, db), true);  // 1 tidak boleh dipindah ke dalam 3
  assert.equal(await isDescendant(1, 1, db), true);  // tidak boleh jadi induk dirinya sendiri
  assert.equal(await isDescendant(5, 1, db), false);
  assert.equal(await isDescendant(1, 3, db), false);
});

test("validator area: nama wajib, URL hanya http(s), kosong -> null, parentId koersi", () => {
  const ok = createBuildingSchema.parse({ name: "  Gedung A ", code: " ", topologyMapUrl: "https://x.example/map", parentId: "3", junk: 1 });
  assert.equal(ok.name, "Gedung A"); assert.equal(ok.code, null); assert.equal(ok.parentId, 3); assert.ok(!("junk" in ok));
  assert.equal(createBuildingSchema.parse({ name: "A", parentId: "" }).parentId, null);
  assert.equal(createBuildingSchema.parse({ name: "A", topologyMapUrl: "" }).topologyMapUrl, null);
  for (const bad of [{ name: "" }, { name: " " }, { name: "x".repeat(151) }, { name: "A", topologyMapUrl: "javascript:alert(1)" },
    { name: "A", topologyMapUrl: "data:text/html,x" }, { name: "A", parentId: "abc" }, { name: "A", parentId: -2 }, { name: "A", code: "x".repeat(31) }]) {
    assert.ok(!createBuildingSchema.safeParse(bad).success, JSON.stringify(bad));
  }
  assert.deepEqual(updateBuildingSchema.parse({ description: "baru" }), { description: "baru" }); // partial: field lain tidak dipaksa
  assert.ok(!updateBuildingSchema.safeParse({ name: "" }).success);
});

test("loadDevice: id tidak valid ditolak tanpa menyentuh database", async () => {
  let dbCalls = 0;
  prismaImpl = { device: { findUnique: async () => { dbCalls++; return null; } } };
  const run = async (id) => { let out; await loadDevice({ params: { id } }, { status: (c) => ({ json: () => (out = c) }) }, () => (out = "next")); return out; };
  for (const bad of ["abc", "-1", "0", "1.5", "1e3x", ""]) assert.equal(await run(bad), 404, bad);
  assert.equal(dbCalls, 0);
  assert.equal(await run("7"), 404); // valid tapi tidak ada
  assert.equal(dbCalls, 1);
});

test("fileStore: path di luar folder upload ditolak", () => {
  process.env.UPLOAD_DIR = "/tmp/cnids-test-up";
  assert.equal(resolveUpload("/uploads/photos/a.jpg"), path.resolve("/tmp/cnids-test-up/photos/a.jpg"));
  for (const bad of ["/uploads/../../etc/passwd", "/uploads/photos/../../../etc/passwd", "/etc/passwd", "/uploads/../cnids-test-up2/x"]) {
    const r = resolveUpload(bad);
    assert.ok(r === null || r.startsWith("/tmp/cnids-test-up/"), bad + " -> " + r);
  }
});

// ---- struktur kode -----------------------------------------------------------------------------
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const SRC = path.join(__dirname, "../src");
const srcFiles = walk(SRC).filter((f) => f.endsWith(".js"));

test("struktur: tidak ada file sumber > 170 baris, controller tipis (tidak menumpuk)", () => {
  for (const f of srcFiles) {
    const lines = fs.readFileSync(f, "utf8").split("\n").length;
    assert.ok(lines <= 170, `${path.relative(SRC, f)} ${lines} baris`);
  }
});

test("struktur: layer rapi — route tidak mengakses prisma; service/util tidak mengimpor controller", () => {
  for (const f of srcFiles) {
    const rel = path.relative(SRC, f), s = fs.readFileSync(f, "utf8");
    if (rel.startsWith("routes/")) assert.ok(!/config\/prisma/.test(s), `${rel} mengakses prisma`);
    if (rel.startsWith("services/") || rel.startsWith("utils/")) assert.ok(!/require\("\.\.\/controllers/.test(s), `${rel} mengimpor controller`);
  }
});

test("struktur: konstanta domain tidak diduplikasi", () => {
  for (const f of srcFiles) {
    const rel = path.relative(SRC, f);
    if (rel === "utils/constants.js") continue;
    const s = fs.readFileSync(f, "utf8");
    assert.ok(!/\["ACTIVE",\s*"ACKNOWLEDGED"\]/.test(s), `${rel} menulis ulang status peringatan terbuka`);
    assert.ok(!/\["ON",\s*"OFF",\s*"NEVER_ON"\]\s*(;|\.includes)/.test(s), `${rel} menulis ulang daftar status`);
  }
});

test("DB: tidak ada query Prisma di dalam loop/map async di controller & route (pola N+1)", () => {
  for (const f of srcFiles.filter((f) => /controllers\/|routes\//.test(f))) {
    const s = fs.readFileSync(f, "utf8");
    assert.ok(!/\.map\(async/.test(s) && !/for\s*\([^)]*\)\s*\{[^}]*await\s+prisma\./s.test(s), `${path.relative(SRC, f)}: kemungkinan N+1`);
  }
});

test("DB: schema memiliki indeks untuk kolom yang dipakai filter/urutan/retensi", () => {
  const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
  for (const idx of ["@@index([deviceId, recordedAt])", "@@index([checkedAt])", "@@index([name])", "@@index([deviceId, checkedAt])", "@@index([status, triggeredAt])", "@@index([poolId])", "@@index([expiresAt])"]) {
    assert.ok(schema.includes(idx), `indeks hilang: ${idx}`);
  }
});

// ---- pengurutan sisi-server ---------------------------------------------------------------------
test("sort: kunci di luar whitelist ditolak; arah bawaan asc", () => {
  const { parseSort } = require("../src/utils/sorting");
  assert.equal(parseSort({ sort: "password" }, ["name"]), null);
  assert.equal(parseSort({ sort: ["name"] }, ["name"]), null);
  assert.deepEqual(parseSort({ sort: "name" }, ["name"]), { key: "name", dir: "asc" });
  assert.deepEqual(parseSort({ sort: "name", order: "desc" }, ["name"]), { key: "name", dir: "desc" });
  assert.deepEqual(parseSort({ sort: "name", order: "; DROP" }, ["name"]), { key: "name", dir: "asc" });
});

test("sort: IP diurutkan per oktet, natural (AP-2 < AP-10), kosong selalu terakhir", () => {
  const { sortedPageIds } = require("../src/utils/sorting");
  const ips = [{ id: 1, value: "10.0.0.10" }, { id: 2, value: "10.0.0.2" }, { id: 3, value: null }, { id: 4, value: "9.1.1.1" }];
  assert.deepEqual(sortedPageIds(ips, "asc", { skip: 0, take: 10, ip: true }), [4, 2, 1, 3]);
  assert.deepEqual(sortedPageIds(ips, "desc", { skip: 0, take: 10, ip: true }), [1, 2, 4, 3]);
  const names = [{ id: 1, value: "AP-10" }, { id: 2, value: "AP-2" }, { id: 3, value: "ap-1" }];
  assert.deepEqual(sortedPageIds(names, "asc", { skip: 0, take: 2 }), [3, 2]);
  assert.deepEqual(sortedPageIds(names, "asc", { skip: 2, take: 2 }), [1]);
});

test("sort: daftar perangkat — viewer tidak bisa mengurutkan berdasarkan MAC; halaman diambil dari id terurut", async () => {
  let selects = [];
  prismaImpl = {
    device: {
      count: async () => 3,
      groupBy: async () => [],
      findMany: async (args) => {
        if (args.select) {
          selects.push(args.select);
          return [{ id: 1, name: "B", ipAddress: "10.0.0.10" }, { id: 2, name: "A", ipAddress: "10.0.0.9" }, { id: 3, name: "C", ipAddress: null }];
        }
        if (args.where?.id) return args.where.id.in.map((id) => ({ id, name: "n" + id }));
        return [];
      },
    },
  };
  const { listDevices } = require("../src/services/deviceService");
  const r = await listDevices({ sort: "ipAddress" }, "ADMIN", { skip: 0, take: 2 });
  assert.deepEqual(r.rows.map((d) => d.id), [2, 1]);
  selects = [];
  await listDevices({ sort: "macAddress" }, "MAHASISWA_DOSEN", { skip: 0, take: 2 });
  assert.equal(selects.length, 0, "viewer tidak boleh memicu pengurutan MAC");
});

// ---- SN unik & pencarian sesuai kolom tampil ------------------------------------------------------
test("SN: dirapikan (trim, huruf besar, spasi ganda) dan kosong -> null", () => {
  const { createDeviceSchema, updateDeviceSchema } = require("../src/utils/validators/deviceValidators");
  assert.equal(createDeviceSchema.parse({ name: "A", serialNumber: "  g1qh 0001  " }).serialNumber, "G1QH 0001");
  assert.equal(createDeviceSchema.parse({ name: "A", serialNumber: "g1qh0001" }).serialNumber, "G1QH0001");
  assert.equal(createDeviceSchema.parse({ name: "A", serialNumber: "   " }).serialNumber, null);
  assert.equal(updateDeviceSchema.parse({ serialNumber: "" }).serialNumber, null);
});

test("SN: dipakai perangkat lain -> 409 menyebut pemiliknya; milik sendiri & kosong lolos", async () => {
  let asked;
  prismaImpl = {
    building: { findUnique: async () => ({ id: 1 }) },
    device: {
      findFirst: async (a) => { asked = a; return a.where.serialNumber === "DUP1" && !(a.where.id?.not === 7) ? { id: 7, name: "SW-Core" } : null; },
      create: async ({ data }) => ({ id: 99, ...data }),
    },
  };
  const { findSerialOwner } = require("../src/services/deviceService");
  assert.deepEqual(await findSerialOwner("DUP1"), { id: 7, name: "SW-Core" });
  assert.equal(await findSerialOwner("DUP1", 7), null, "perangkat yang sama boleh menyimpan SN-nya sendiri");
  assert.equal(await findSerialOwner(null), null);
  assert.equal(await findSerialOwner("UNIK"), null);
  assert.deepEqual(asked.where, { serialNumber: "UNIK" });
});

test("pencarian perangkat: hanya kolom yang tampil (+ nama area); MAC hanya admin", async () => {
  const { buildBaseWhere } = require("../src/services/deviceService");
  const viewer = await buildBaseWhere({ search: "x" }, "MAHASISWA_DOSEN");
  const admin = await buildBaseWhere({ search: "x" }, "ADMIN");
  const keys = (w) => w.OR.map((o) => Object.keys(o)[0]).sort();
  assert.deepEqual(keys(viewer), ["building", "ipAddress", "model", "name", "serialNumber"]);
  assert.deepEqual(keys(admin), ["building", "ipAddress", "macAddress", "model", "name", "serialNumber"]);
  const typed = await buildBaseWhere({ type: "SWITCH" }, "ADMIN");
  assert.equal(typed.type, "SWITCH");
  assert.equal((await buildBaseWhere({ type: "SWITCH" }, "ADMIN", { skipType: true })).type, undefined);
});

// ---- revisi: IP/MAC ketat, jeda ping per perangkat, status langsung berubah -----------------------------------------
test("jeda ping: isDue per perangkat (belum pernah dicek, belum/sudah lewat jeda)", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  const ago = (s) => new Date(now.getTime() - s * 1000);
  assert.equal(monitoring.isDue({ pingIntervalSec: 60, lastCheckedAt: null }, now), true);
  assert.equal(monitoring.isDue({ pingIntervalSec: 60, lastCheckedAt: ago(30) }, now), false);
  assert.equal(monitoring.isDue({ pingIntervalSec: 60, lastCheckedAt: ago(60) }, now), true);
  assert.equal(monitoring.isDue({ pingIntervalSec: 600, lastCheckedAt: ago(300) }, now), false);
  assert.equal(monitoring.isDue({ pingIntervalSec: 10, lastCheckedAt: ago(11) }, now), true);
  assert.equal(monitoring.isDue({ lastCheckedAt: ago(299) }, now), false); // tanpa nilai -> bawaan 300 dtk
});

test("jeda ping: scheduler hanya mem-ping perangkat yang jedanya sudah lewat", async () => {
  const now = new Date();
  const ago = (s) => new Date(now.getTime() - s * 1000);
  const devices = [
    { id: 1, name: "cepat-lewat", ipAddress: "10.0.0.1", monitorMethod: "ICMP", pingIntervalSec: 10, lastCheckedAt: ago(20) },
    { id: 2, name: "cepat-belum", ipAddress: "10.0.0.2", monitorMethod: "ICMP", pingIntervalSec: 10, lastCheckedAt: ago(3) },
    { id: 3, name: "lambat-belum", ipAddress: "10.0.0.3", monitorMethod: "ICMP", pingIntervalSec: 3600, lastCheckedAt: ago(1000) },
    { id: 4, name: "baru", ipAddress: "10.0.0.4", monitorMethod: "ICMP", pingIntervalSec: 3600, lastCheckedAt: null },
  ];
  const pinged = [];
  prismaImpl = {
    device: { findMany: async () => devices },
    $transaction: async (fn) => fn({
      device: { update: async ({ where }) => { pinged.push(where.id); return { monitorMethod: "ICMP", onlineStatus: "ON", lastOnlineAt: new Date() }; } },
      statusCheck: { create: async (a) => a.data },
      deviceAlert: { findMany: async () => [], createMany: async () => ({}), updateMany: async () => ({}) },
      deviceHistory: { create: async () => ({}) },
    }),
  };
  pingStats.alive = true;
  const r = await monitoring.runDueChecks(now);
  assert.equal(r.total, 2);
  assert.deepEqual([...new Set(pinged)].sort(), [1, 4]);
});

test("pengecekan manual: respons memuat status perangkat terbaru supaya tampilan langsung berubah", async () => {
  const { triggerCheck } = require("../src/controllers/monitoringController");
  const device = { id: 7, name: "SW", ipAddress: "10.0.0.7", monitorMethod: "ICMP", onlineStatus: "OFF", lastOnlineAt: new Date(), offlineSince: new Date() };
  const after = { id: 7, onlineStatus: "ON", lastOnlineAt: new Date(), offlineSince: null, lastCheckedAt: new Date() };
  prismaImpl = {
    device: { findUnique: async () => after },
    activityLog: { create: async () => ({}) },
    $transaction: async (fn) => fn({
      device: { update: async () => ({ ...device }) },
      statusCheck: { create: async (a) => ({ id: 1, ...a.data }) },
      deviceAlert: { findMany: async () => [], createMany: async () => ({}), updateMany: async () => ({}) },
      deviceHistory: { create: async () => ({}) },
    }),
  };
  pingStats.alive = true;
  let body;
  await triggerCheck({ device, user: { id: 1 } }, { status: () => ({ json: () => {} }), json: (b) => { body = b; } });
  assert.equal(body.device.onlineStatus, "ON");
  assert.equal(body.check.status, "UP");
});

test("validator perangkat: IP hanya angka+titik, MAC hanya 0-9/A-F, jeda ping 10 dtk - 24 jam", () => {
  const { createDeviceSchema, updateDeviceSchema } = require("../src/utils/validators/deviceValidators");
  const ok = (o) => createDeviceSchema.safeParse({ name: "x", ...o });
  for (const bad of ["abc", "192.168.1", "192.168.1.256", "192.168.1.a", "192,168,1,1", "1.1.1.1\n"]) assert.ok(!ok({ ipAddress: bad }).success, "IP lolos: " + bad);
  assert.equal(ok({ ipAddress: "  10.1.0.3 " }).data.ipAddress, "10.1.0.3");
  assert.equal(ok({ ipAddress: "" }).data.ipAddress, null);
  for (const bad of ["GG:00:00:00:00:00", "00:D0:F8", "00D0F81234567", "zz-zz-zz-zz-zz-zz"]) assert.ok(!ok({ macAddress: bad }).success, "MAC lolos: " + bad);
  assert.equal(ok({ macAddress: "00d0f8123456" }).data.macAddress, "00:D0:F8:12:34:56");
  assert.equal(ok({ macAddress: "00-d0-f8-12-34-56" }).data.macAddress, "00:D0:F8:12:34:56");
  assert.equal(ok({}).data.pingIntervalSec, 300);
  assert.equal(ok({ pingIntervalSec: "45" }).data.pingIntervalSec, 45);
  for (const bad of [9, 0, -5, 86401, 1.5, "abc"]) assert.ok(!ok({ pingIntervalSec: bad }).success, "jeda lolos: " + bad);
  assert.ok(ok({ pingIntervalSec: 10 }).success && ok({ pingIntervalSec: 86400 }).success);
  // PATCH sebagian tidak boleh mengembalikan jenis/pemantauan/jeda ke bawaan
  assert.deepEqual(updateDeviceSchema.parse({ name: "y" }), { name: "y" });
});

// ---- pengaturan peringatan oleh Superadmin ---------------------------------------------------------------------------
test("pengaturan peringatan: keputusan mengikuti ambang, jumlah ping gagal, tingkat, dan saklar", () => {
  const { decideAlerts } = require("../src/services/alertSync");
  const base = { everOnline: true, openTypes: [], consecutiveDown: 1 };
  const S = { offlineEnabled: true, offlineAfterFailures: 1, offlineSeverity: "CRITICAL", latencyEnabled: true, latencyThresholdMs: 200, latencySeverity: "WARNING" };
  // bawaan: sama seperti perilaku lama
  let r = decideAlerts({ ...base, pingStatus: "DOWN", settings: S });
  assert.deepEqual(r.open.map((a) => [a.type, a.severity]), [["OFFLINE", "CRITICAL"]]);
  // butuh 3 ping gagal berturut-turut
  const S3 = { ...S, offlineAfterFailures: 3 };
  assert.equal(decideAlerts({ ...base, pingStatus: "DOWN", consecutiveDown: 2, settings: S3 }).open.length, 0);
  r = decideAlerts({ ...base, pingStatus: "DOWN", consecutiveDown: 3, settings: S3 });
  assert.match(r.open[0].message, /3 kali berturut-turut/);
  // tingkat Off diubah
  assert.equal(decideAlerts({ ...base, pingStatus: "DOWN", settings: { ...S, offlineSeverity: "WARNING" } }).open[0].severity, "WARNING");
  // ambang latensi: 150 ms aman di 200, memicu di 100; tingkat mengikuti pengaturan
  assert.equal(decideAlerts({ ...base, pingStatus: "UP", latencyMs: 150, settings: S }).open.length, 0);
  r = decideAlerts({ ...base, pingStatus: "UP", latencyMs: 150, settings: { ...S, latencyThresholdMs: 100, latencySeverity: "CRITICAL" } });
  assert.deepEqual([r.open[0].type, r.open[0].severity], ["HIGH_LATENCY", "CRITICAL"]);
  assert.match(r.open[0].message, /ambang 100 ms/);
  // saklar mati: tidak dibuka, yang terbuka ditutup
  assert.equal(decideAlerts({ ...base, pingStatus: "DOWN", settings: { ...S, offlineEnabled: false } }).open.length, 0);
  r = decideAlerts({ ...base, pingStatus: "UP", latencyMs: 900, openTypes: ["HIGH_LATENCY"], settings: { ...S, latencyEnabled: false } });
  assert.equal(r.open.length, 0); assert.deepEqual(r.resolve, ["HIGH_LATENCY"]);
  r = decideAlerts({ ...base, pingStatus: "DOWN", openTypes: ["OFFLINE"], settings: { ...S, offlineEnabled: false } });
  assert.deepEqual(r.resolve, ["OFFLINE"]);
  // tanpa IP (UNKNOWN) tidak mengubah apa pun, walau saklar mati
  r = decideAlerts({ ...base, pingStatus: "UNKNOWN", openTypes: ["OFFLINE"], settings: { ...S, offlineEnabled: false } });
  assert.deepEqual(r, { open: [], resolve: [] });
  // belum pernah On tetap tidak membuat peringatan
  assert.equal(decideAlerts({ ...base, everOnline: false, pingStatus: "DOWN", settings: S }).open.length, 0);
});

test("pengaturan peringatan: syncAlerts menghitung ping gagal berturut-turut dari riwayat ping", async () => {
  const { syncAlerts } = require("../src/services/alertSync");
  const S = { offlineEnabled: true, offlineAfterFailures: 3, offlineSeverity: "CRITICAL", latencyEnabled: true, latencyThresholdMs: 200, latencySeverity: "WARNING" };
  const run = async (statuses) => {
    let created = [];
    const db = {
      deviceAlert: { findMany: async () => [], createMany: async ({ data }) => { created = data; }, updateMany: async () => ({}) },
      statusCheck: { findMany: async ({ take }) => statuses.slice(0, take).map((status) => ({ status })) },
    };
    await syncAlerts(db, { id: 1, lastOnlineAt: new Date() }, "DOWN", null, new Date(), S);
    return created;
  };
  assert.equal((await run(["DOWN", "DOWN", "UP"])).length, 0, "2 gagal lalu UP belum cukup");
  assert.equal((await run(["DOWN", "UP", "DOWN"])).length, 0, "tidak berturut-turut");
  assert.equal((await run(["DOWN", "DOWN", "DOWN"])).length, 1);
});

test("pengaturan peringatan: nilai bawaan bila tabel belum ada; validasi batas; hanya Superadmin yang mengubah", async () => {
  const svc = require("../src/services/alertSettingsService");
  const { alertSettingsSchema } = require("../src/utils/validators/alertSettingsValidators");
  svc.resetCache();
  prismaImpl = {}; // tabel belum ada -> error -> bawaan
  const def = await svc.getAlertSettings();
  assert.deepEqual([def.offlineEnabled, def.offlineAfterFailures, def.latencyThresholdMs], [true, 1, 200]);
  svc.resetCache();
  prismaImpl = { alertSetting: { findUnique: async () => ({ id: 1, offlineEnabled: false, offlineAfterFailures: 4, offlineSeverity: "WARNING", latencyEnabled: true, latencyThresholdMs: 350, latencySeverity: "CRITICAL", updatedAt: new Date() }) } };
  assert.equal((await svc.getAlertSettings()).latencyThresholdMs, 350);
  svc.resetCache();

  const ok = { offlineEnabled: true, offlineAfterFailures: 2, offlineSeverity: "CRITICAL", latencyEnabled: true, latencyThresholdMs: 300, latencySeverity: "WARNING" };
  assert.ok(alertSettingsSchema.safeParse(ok).success);
  for (const bad of [{ offlineAfterFailures: 0 }, { offlineAfterFailures: 11 }, { latencyThresholdMs: 5 }, { latencyThresholdMs: 10001 }, { latencyThresholdMs: 1.5 }, { offlineSeverity: "INFO" }, { offlineEnabled: "ya" }]) {
    assert.ok(!alertSettingsSchema.safeParse({ ...ok, ...bad }).success, "lolos: " + JSON.stringify(bad));
  }
  // rute: PUT hanya Superadmin
  const src = fs.readFileSync(path.join(__dirname, "../src/routes/alertRoutes.js"), "utf8");
  assert.match(src, /router\.put\("\/settings", requireRole\("SUPERADMIN"\)/);
  assert.match(src, /router\.get\("\/settings"/);
});

test("CORS: semua metode yang dipakai rute (termasuk PUT pengaturan peringatan) diizinkan di preflight", () => {
  const app = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const allowed = JSON.parse(app.match(/methods:\s*(\[[^\]]*\])/)[1]);
  const used = new Set();
  for (const f of fs.readdirSync(path.join(__dirname, "../src/routes"))) {
    for (const m of fs.readFileSync(path.join(__dirname, "../src/routes", f), "utf8").matchAll(/router\.(get|post|put|patch|delete)\(/g)) used.add(m[1].toUpperCase());
  }
  for (const m of used) assert.ok(allowed.includes(m), `metode ${m} dipakai rute tetapi tidak ada di CORS methods`);
});
