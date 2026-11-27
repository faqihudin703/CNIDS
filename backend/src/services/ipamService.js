const prisma = require("../config/prisma");
const { computePool, poolFromRecord } = require("../utils/ipPool");

const MAX_ENTRIES = 5000; // pengaman: daftar IP tanpa paginasi tidak boleh tumbuh tanpa batas

// Urut numerik per oktet (192.168.1.2 sebelum 192.168.1.10), bukan urutan string.
function compareIp(a, b) {
  const ka = a.split(".").map(Number);
  const kb = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return 0;
}

async function listIpEntries({ search, vlan, portMode, poolId }) {
  const where = { ipInterface: { not: null } };
  if (poolId) where.poolId = Number(poolId);
  if (vlan) where.vlan = vlan;
  if (portMode) where.portMode = portMode;
  if (search) {
    where.OR = [
      { ipInterface: { contains: search } },
      { interfaceName: { contains: search } },
      { vlan: { contains: search } },
      { description: { contains: search } },
      { device: { name: { contains: search } } },
    ];
  }

  const ports = await prisma.devicePort.findMany({
    where,
    select: {
      id: true, ipInterface: true, prefix: true, poolId: true, vlan: true, portMode: true,
      description: true, interfaceName: true, device: { select: { id: true, name: true } },
    },
    take: MAX_ENTRIES + 1,
  });
  const truncated = ports.length > MAX_ENTRIES;

  const data = ports
    .slice(0, MAX_ENTRIES)
    .sort((a, b) => compareIp(a.ipInterface, b.ipInterface))
    .map((p) => ({ ...p, pool: computePool(p.ipInterface, p.prefix) }));
  return { data, total: data.length, truncated };
}

/**
 * Pool unik (satu baris per network + prefix) beserta pemakaiannya. Hanya 3 query tetap (pool, port ber-pool,
 * nama perangkat) — tidak ada query per pool; kolom yang dimuat dibatasi ke yang diperlukan.
 */
async function listPools({ search }) {
  const [pools, ports] = await Promise.all([
    prisma.ipPool.findMany(),
    prisma.devicePort.findMany({
      where: { poolId: { not: null } },
      select: { poolId: true, ipInterface: true, vlan: true, deviceId: true },
    }),
  ]);
  const deviceIds = [...new Set(ports.map((p) => p.deviceId))];
  const devices = deviceIds.length
    ? await prisma.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } })
    : [];
  const deviceById = new Map(devices.map((d) => [d.id, d]));

  const portsByPool = new Map();
  for (const p of ports) {
    if (!portsByPool.has(p.poolId)) portsByPool.set(p.poolId, []);
    portsByPool.get(p.poolId).push(p);
  }

  let result = pools.map((pool) => {
    const info = poolFromRecord(pool);
    const poolPorts = portsByPool.get(pool.id) ?? [];
    const usedIps = new Set(poolPorts.map((p) => p.ipInterface));
    const poolDevices = new Map();
    const vlans = new Set();
    for (const p of poolPorts) {
      poolDevices.set(p.deviceId, deviceById.get(p.deviceId));
      if (p.vlan) vlans.add(p.vlan);
    }
    return {
      id: pool.id,
      ...info,
      used: usedIps.size,
      portCount: poolPorts.length,
      utilization: info.hosts > 0 ? Math.min(usedIps.size / info.hosts, 1) : 0,
      devices: [...poolDevices.values()].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
      vlans: [...vlans].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    };
  });

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) =>
        p.cidr.includes(q) ||
        p.range.includes(q) ||
        p.vlans.some((v) => v.toLowerCase().includes(q)) ||
        p.devices.some((d) => d.name.toLowerCase().includes(q))
    );
  }

  result.sort((a, b) => compareIp(a.cidr.split("/")[0], b.cidr.split("/")[0]) || a.cidr.localeCompare(b.cidr, undefined, { numeric: true }));
  return { data: result, total: result.length };
}

module.exports = { listIpEntries, listPools, compareIp };
