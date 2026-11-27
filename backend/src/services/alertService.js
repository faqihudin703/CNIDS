const prisma = require("../config/prisma");
const { OPEN_ALERT_STATUSES } = require("../utils/constants");

/**
 * Semua hitungan peringatan dari SATU query (groupBy status + severity), dipakai badge sidebar,
 * halaman Peringatan, dan dashboard — sebelumnya masing-masing menjalankan 2–4 query count terpisah.
 */
async function getAlertCounts(db = prisma) {
  const rows = await db.deviceAlert.groupBy({ by: ["status", "severity"], _count: { _all: true } });
  const c = { active: 0, acknowledged: 0, resolved: 0, critical: 0, activeCritical: 0, open: 0 };
  for (const r of rows) {
    const n = r._count._all;
    if (r.status === "ACTIVE") c.active += n;
    if (r.status === "ACKNOWLEDGED") c.acknowledged += n;
    if (r.status === "RESOLVED") c.resolved += n;
    if (OPEN_ALERT_STATUSES.includes(r.status)) {
      c.open += n;
      if (r.severity === "CRITICAL") c.critical += n;
    }
    if (r.status === "ACTIVE" && r.severity === "CRITICAL") c.activeCritical += n;
  }
  return c;
}

module.exports = { getAlertCounts };
