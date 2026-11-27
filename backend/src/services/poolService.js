const { computePool, parsePrefix } = require("../utils/ipPool");

/**
 * Mengembalikan id IpPool untuk pasangan IP + prefix. Bila pool dengan network + prefix yang sama
 * sudah ada, baris itu dipakai ulang (pool yang sama tidak menumpuk); bila belum, dibuat baru.
 * Mengembalikan null bila IP/prefix kosong atau tidak valid (mis. port Trunk).
 *
 * @param db     prisma client atau transaction client
 * @param cache  Map opsional agar batch besar tidak mengulang query untuk pool yang sama
 */
async function resolvePoolId(db, ip, prefix, cache) {
  const pool = computePool(ip, prefix);
  if (!pool) return null;
  if (cache && cache.has(pool.cidr)) return cache.get(pool.cidr);

  const prefixLength = parsePrefix(prefix);
  const row = await db.ipPool.upsert({
    where: { network_prefixLength: { network: pool.network, prefixLength } },
    update: {},
    create: { network: pool.network, prefixLength },
  });
  if (cache) cache.set(pool.cidr, row.id);
  return row.id;
}

// Pool yang sudah tidak dipakai port mana pun dihapus supaya daftar pool tetap bersih.
// Pool yang baru dibuat (< 1 menit) dilewati: bisa saja sedang dipakai request lain yang baru akan menyimpan portnya,
// sehingga tidak terjadi balapan "pool dihapus tepat sebelum port memakainya".
const ORPHAN_GRACE_MS = 60_000;
async function cleanupOrphanPools(db) {
  const result = await db.ipPool.deleteMany({
    where: { ports: { none: {} }, createdAt: { lt: new Date(Date.now() - ORPHAN_GRACE_MS) } },
  });
  return result.count;
}

module.exports = { resolvePoolId, cleanupOrphanPools };
