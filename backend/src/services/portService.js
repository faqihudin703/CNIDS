const prisma = require("../config/prisma");
const { normalizePort } = require("../utils/portRules");
const { resolvePoolId, cleanupOrphanPools } = require("./poolService");

// Setiap operasi yang menyentuh port + pool dijalankan dalam satu transaksi: pool baru, port, dan pembersihan
// pool yatim berhasil/gagal bersama (tidak ada pool setengah jadi bila langkah tengah gagal).

async function createPort(deviceId, input) {
  const data = normalizePort(input);
  return prisma.$transaction(async (tx) => {
    data.poolId = await resolvePoolId(tx, data.ipInterface, data.prefix);
    return tx.devicePort.create({ data: { ...data, deviceId } });
  });
}

// Batch: satu upsert per pool UNIK (bukan per port), lalu satu createMany.
async function bulkCreatePorts(deviceId, ports) {
  return prisma.$transaction(async (tx) => {
    const cache = new Map();
    const rows = [];
    for (const p of ports) {
      const data = normalizePort(p);
      data.poolId = await resolvePoolId(tx, data.ipInterface, data.prefix, cache);
      rows.push({ ...data, deviceId });
    }
    // nama interface yang sudah ada dilewati, bukan menggagalkan semuanya
    const result = await tx.devicePort.createMany({ data: rows, skipDuplicates: true });
    await cleanupOrphanPools(tx);
    return result.count;
  });
}

async function generatePorts(deviceId, { namePrefix, start, end, portMode, vlan, description }) {
  const data = [];
  for (let n = start; n <= end; n++) {
    data.push({ ...normalizePort({ interfaceName: `${namePrefix}${n}`, portMode, vlan, description }), deviceId });
  }
  const result = await prisma.devicePort.createMany({ data, skipDuplicates: true });
  return { created: result.count, requested: data.length };
}

async function updatePort(portId, input) {
  const data = normalizePort(input);
  return prisma.$transaction(async (tx) => {
    data.poolId = await resolvePoolId(tx, data.ipInterface, data.prefix);
    const port = await tx.devicePort.update({ where: { id: portId }, data });
    await cleanupOrphanPools(tx); // pool lama yang tidak dipakai lagi (IP pindah pool / jadi Trunk)
    return port;
  });
}

async function deletePort(portId) {
  return prisma.$transaction(async (tx) => {
    await tx.devicePort.delete({ where: { id: portId } });
    await cleanupOrphanPools(tx);
  });
}

module.exports = { createPort, bulkCreatePorts, generatePorts, updatePort, deletePort };
