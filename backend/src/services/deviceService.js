const prisma = require("../config/prisma");
const { isAdminOrAbove } = require("../utils/roles");
const { areaWithDescendants } = require("../utils/areaTree");
const { ONLINE_STATUSES } = require("../utils/constants");
const { cleanupOrphanPools } = require("./poolService");
const { removeUploads } = require("../utils/fileStore");
const { parseSort, sortedPageIds } = require("../utils/sorting");

// Field yang TIDAK boleh dilihat oleh Mahasiswa/Dosen (viewer): catatan, MAC (spoofing), versi firmware (celah dikenal).
const SENSITIVE_FIELDS = ["notes", "macAddress", "firmwareVersion"];
// Pencarian HANYA pada kolom yang tampil di tabel perangkat: Nama, SN, Model, IP Manajemen, MAC (admin), Area/Gedung.
const SEARCH_FIELDS = ["name", "serialNumber", "model", "ipAddress"];
const HISTORY_LIMIT = 200; // riwayat di halaman detail dibatasi (yang terbaru)

function stripSensitiveFields(device, role) {
  if (isAdminOrAbove(role)) return device;
  const sanitized = { ...device };
  for (const field of SENSITIVE_FIELDS) delete sanitized[field];
  return sanitized;
}

// `where` TANPA filter status; dipakai juga untuk menghitung jumlah per status (tab Semua/On/Off/Never On).
async function buildBaseWhere(query, role, { skipType = false } = {}) {
  const { buildingId, search, type, unassigned } = query;
  const where = {};
  if (unassigned === "true") where.buildingId = null;
  else if (buildingId) where.buildingId = { in: await areaWithDescendants(Number(buildingId)) };
  if (type && !skipType) where.type = type;
  if (search) {
    // Catatan: LIKE '%kata%' tidak bisa memakai indeks (scan penuh). Aman untuk ribuan perangkat; untuk jauh lebih
    // besar gunakan FULLTEXT index. MAC hanya dapat dicari oleh admin agar viewer tidak bisa menebaknya lewat pencarian.
    const fields = isAdminOrAbove(role) ? [...SEARCH_FIELDS, "macAddress"] : SEARCH_FIELDS;
    where.OR = [...fields.map((f) => ({ [f]: { contains: search } })), { building: { name: { contains: search } } }];
  }
  return where;
}

// Kolom yang boleh diurutkan. `status` memakai orderBy DB; sisanya diurutkan secara natural di JS (kolom kecil: id + nilai)
// karena collation MySQL tidak "natural" (AP-10 mendahului AP-2) dan NULL-nya tidak bisa dipaksa di akhir.
const DEVICE_SORT_VALUE = {
  name: (d) => d.name,
  serialNumber: (d) => d.serialNumber,
  model: (d) => d.model,
  ipAddress: (d) => d.ipAddress,
  macAddress: (d) => d.macAddress,
  building: (d) => d.building?.name,
};
const DEVICE_SORT_SELECT = {
  name: { name: true }, serialNumber: { serialNumber: true }, model: { model: true },
  ipAddress: { ipAddress: true }, macAddress: { macAddress: true }, building: { building: { select: { name: true } } },
};

async function fetchDeviceRows(where, sort, role, { skip, take }) {
  const include = { building: { select: { id: true, name: true } }, _count: { select: { ports: true } } };
  if (!sort || sort.key === "status") {
    const dir = sort?.dir ?? "asc";
    return prisma.device.findMany({
      where, include,
      orderBy: sort ? [{ onlineStatus: dir }, { name: "asc" }] : [{ name: "asc" }],
      skip, take,
    });
  }
  const items = (await prisma.device.findMany({ where, select: { id: true, ...DEVICE_SORT_SELECT[sort.key] } })).map((d) => ({
    id: d.id,
    value: DEVICE_SORT_VALUE[sort.key](d),
  }));
  const ids = sortedPageIds(items, sort.dir, { skip, take, ip: sort.key === "ipAddress" });
  const rows = await prisma.device.findMany({ where: { id: { in: ids } }, include });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function listDevices(query, role, { skip, take }) {
  const baseWhere = await buildBaseWhere(query, role);
  // MAC hanya boleh diurutkan oleh admin (field sensitif untuk viewer).
  const sort = parseSort(query, isAdminOrAbove(role) ? [...Object.keys(DEVICE_SORT_VALUE), "status"] : [...Object.keys(DEVICE_SORT_VALUE).filter((k) => k !== "macAddress"), "status"]);
  const where = ONLINE_STATUSES.includes(query.status) ? { ...baseWhere, onlineStatus: query.status } : baseWhere;

  // Opsi filter "Jenis" dinamis: hanya jenis yang ada pada hasil saat ini (mengikuti pencarian, area, dan status), bukan semua enum.
  const facetWhere = ONLINE_STATUSES.includes(query.status)
    ? { ...(await buildBaseWhere(query, role, { skipType: true })), onlineStatus: query.status }
    : await buildBaseWhere(query, role, { skipType: true });

  const [total, rows, grouped, typeGroups] = await Promise.all([
    prisma.device.count({ where }),
    fetchDeviceRows(where, sort, role, { skip, take }),
    prisma.device.groupBy({ by: ["onlineStatus"], where: baseWhere, _count: { _all: true } }),
    prisma.device.groupBy({ by: ["type"], where: facetWhere, _count: { _all: true } }),
  ]);

  const counts = { ALL: 0, ON: 0, OFF: 0, NEVER_ON: 0 };
  for (const g of grouped) {
    counts[g.onlineStatus] = g._count._all;
    counts.ALL += g._count._all;
  }
  const types = typeGroups.map((g) => ({ value: g.type, count: g._count._all })).sort((a, b) => b.count - a.count);
  return { rows: rows.map((d) => stripSensitiveFields(d, role)), total, counts, facets: { types } };
}

/** Satu SN hanya boleh dimiliki satu perangkat. Mengembalikan perangkat pemegang SN (selain `exceptId`) atau null. */
async function findSerialOwner(serialNumber, exceptId = null) {
  if (!serialNumber) return null;
  return prisma.device.findFirst({
    where: { serialNumber, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, name: true },
  });
}

async function getDeviceDetail(id, role) {
  const admin = isAdminOrAbove(role);
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, name: true, parentId: true } },
      // Detail port dan daftar file konfigurasi sama sensitifnya dengan konfigurasi itu sendiri -> admin only.
      ports: admin ? { orderBy: { interfaceName: "asc" } } : false,
      photos: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { recordedAt: "desc" }, take: HISTORY_LIMIT },
      configs: admin ? { orderBy: { uploadedAt: "desc" } } : false,
      statusChecks: { orderBy: { checkedAt: "desc" }, take: 10 },
    },
  });
  return device && stripSensitiveFields(device, role);
}

/**
 * Hapus perangkat beserta turunannya (cascade di DB) dalam satu transaksi, lalu hapus FILE fisik foto/konfigurasinya.
 * Sebelumnya file tertinggal di disk selamanya karena hanya baris DB yang ikut terhapus.
 */
async function deleteDevice(id) {
  const [photos, configs] = await Promise.all([
    prisma.devicePhoto.findMany({ where: { deviceId: id }, select: { fileUrl: true } }),
    prisma.deviceConfig.findMany({ where: { deviceId: id }, select: { fileUrl: true } }),
  ]);
  await prisma.$transaction(async (tx) => {
    await tx.device.delete({ where: { id } });
    await cleanupOrphanPools(tx);
  });
  await removeUploads([...photos, ...configs].map((f) => f.fileUrl));
}

module.exports = { findSerialOwner, listDevices, getDeviceDetail, deleteDevice, stripSensitiveFields, buildBaseWhere };
