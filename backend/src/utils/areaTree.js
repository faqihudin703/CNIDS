const prisma = require("../config/prisma");

// Area berbentuk pohon (Building.parentId). Tabelnya kecil, jadi seluruh relasi induk-anak dimuat dengan SATU query.
async function loadParentMap(db = prisma) {
  const all = await db.building.findMany({ select: { id: true, parentId: true } });
  return new Map(all.map((b) => [b.id, b.parentId]));
}

// id area + seluruh turunannya (filter area di daftar perangkat ikut menyertakan sub-area).
async function areaWithDescendants(rootId, db = prisma) {
  const parentOf = await loadParentMap(db);
  const childrenOf = new Map();
  for (const [id, parentId] of parentOf) {
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId).push(id);
  }
  const ids = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    ids.push(id);
    queue.push(...(childrenOf.get(id) || []));
  }
  return ids;
}

// true bila `candidateId` adalah `ancestorId` itu sendiri atau salah satu turunannya (akan membentuk siklus).
async function isDescendant(candidateId, ancestorId, db = prisma) {
  const parentOf = await loadParentMap(db);
  const seen = new Set();
  let cursor = candidateId;
  while (cursor != null && !seen.has(cursor)) {
    if (cursor === ancestorId) return true;
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

module.exports = { areaWithDescendants, isDescendant };
