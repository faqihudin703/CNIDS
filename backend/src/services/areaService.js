const prisma = require("../config/prisma");
const { isDescendant } = require("../utils/areaTree");

const EMPTY_COUNTS = () => ({ ON: 0, OFF: 0, NEVER_ON: 0 });

// Daftar datar seluruh area (frontend menyusun pohonnya), tiap area membawa jumlah perangkat LANGSUNG per status.
// 2 query tetap (area + groupBy), bukan hitung per area.
async function listAreasWithStatus() {
  const [buildings, grouped] = await Promise.all([
    prisma.building.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { devices: true, children: true } } },
    }),
    prisma.device.groupBy({ by: ["buildingId", "onlineStatus"], _count: { _all: true } }),
  ]);

  const statusByArea = new Map();
  for (const g of grouped) {
    const key = g.buildingId ?? 0; // 0 = perangkat tanpa area
    if (!statusByArea.has(key)) statusByArea.set(key, EMPTY_COUNTS());
    statusByArea.get(key)[g.onlineStatus] = g._count._all;
  }

  return {
    data: buildings.map((b) => ({ ...b, statusCounts: statusByArea.get(b.id) ?? EMPTY_COUNTS() })),
    unassigned: statusByArea.get(0) ?? EMPTY_COUNTS(),
  };
}

// Memastikan area induk ada dan tidak membentuk siklus. Mengembalikan pesan error, atau null bila valid.
async function validateParent(parentId, selfId) {
  if (parentId == null) return null;
  if (!(await prisma.building.findUnique({ where: { id: parentId }, select: { id: true } }))) {
    return "Area induk tidak ditemukan";
  }
  if (selfId != null && (await isDescendant(parentId, selfId))) {
    return "Area tidak dapat dipindahkan ke dalam dirinya sendiri atau sub-areanya";
  }
  return null;
}

module.exports = { listAreasWithStatus, validateParent };
