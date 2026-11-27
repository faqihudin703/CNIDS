// Mengisi device_ports.pool_id untuk port yang sudah punya IP + prefix (data lama sebelum ada tabel ip_pools).
// Aman dijalankan berulang kali.  Jalankan: npm run backfill:pools
const { PrismaClient } = require("@prisma/client");
const { resolvePoolId, cleanupOrphanPools } = require("../src/services/poolService");

const prisma = new PrismaClient();

async function main() {
  const ports = await prisma.devicePort.findMany({
    where: { ipInterface: { not: null }, prefix: { not: null } },
    select: { id: true, ipInterface: true, prefix: true, poolId: true },
  });

  const cache = new Map();
  let updated = 0;
  for (const port of ports) {
    const poolId = await resolvePoolId(prisma, port.ipInterface, port.prefix, cache);
    if (poolId !== port.poolId) {
      await prisma.devicePort.update({ where: { id: port.id }, data: { poolId } });
      updated++;
    }
  }
  const removed = await cleanupOrphanPools(prisma);
  console.log(`Selesai: ${ports.length} port diperiksa, ${updated} diperbarui, ${cache.size} pool unik, ${removed} pool yatim dihapus.`);
}

main()
  .catch((e) => {
    console.error("Backfill gagal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
