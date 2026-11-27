const prisma = require("../config/prisma");

const DAY = 24 * 3600 * 1000;
const BATCH = 5000;
const days = (envName, fallback) => Math.max(1, Number(process.env[envName]) || fallback);

// Hapus bertahap (per BATCH baris) agar satu DELETE raksasa tidak mengunci tabel lama-lama.
async function deleteInBatches(model, where) {
  let total = 0;
  for (;;) {
    const rows = await model.findMany({ where, select: { id: true }, take: BATCH });
    if (!rows.length) return total;
    const r = await model.deleteMany({ where: { id: { in: rows.map((x) => x.id) } } });
    total += r.count;
    if (rows.length < BATCH) return total;
  }
}

/**
 * Pembersihan data yang tumbuh terus tanpa batas:
 *  - status_checks (satu baris per ping per perangkat, ±288/hari/perangkat) -> STATUS_RETENTION_DAYS (default 30)
 *  - device_alerts berstatus RESOLVED -> ALERT_RETENTION_DAYS (default 180)
 *  - sessions kedaluwarsa
 */
async function purgeStaleData(db = prisma, now = Date.now()) {
  const statusChecks = await deleteInBatches(db.statusCheck, {
    checkedAt: { lt: new Date(now - days("STATUS_RETENTION_DAYS", 30) * DAY) },
  });
  const alerts = await deleteInBatches(db.deviceAlert, {
    status: "RESOLVED",
    resolvedAt: { lt: new Date(now - days("ALERT_RETENTION_DAYS", 180) * DAY) },
  });
  const sessions = await deleteInBatches(db.session, { expiresAt: { lt: new Date(now) } });
  return { statusChecks, alerts, sessions };
}

module.exports = { purgeStaleData, deleteInBatches };
