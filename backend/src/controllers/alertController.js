const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { parsePagination } = require("../utils/pagination");
const { OPEN_ALERT_STATUSES } = require("../utils/constants");
const { parseSort } = require("../utils/sorting");
const { getAlertCounts } = require("../services/alertService");

// Ringkasan ringan untuk badge di sidebar (1 query).
async function summary(req, res) {
  const c = await getAlertCounts();
  return res.json({ active: c.active, critical: c.activeCritical });
}

const ALERT_ORDER = {
  severity: (d) => ({ severity: d }),
  device: (d) => ({ device: { name: d } }),
  message: (d) => ({ message: d }),
  triggeredAt: (d) => ({ triggeredAt: d }),
  status: (d) => ({ status: d }),
};

async function listAlerts(req, res) {
  const { view = "active", severity, type, deviceId } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const where = {};
  if (view === "active") where.status = { in: OPEN_ALERT_STATUSES };
  else if (view === "resolved") where.status = "RESOLVED";
  if (["CRITICAL", "WARNING"].includes(severity)) where.severity = severity;
  if (["OFFLINE", "HIGH_LATENCY"].includes(type)) where.type = type;
  if (deviceId) where.deviceId = Number(deviceId);
  // Pencarian hanya pada kolom yang tampil: Perangkat dan Peringatan (pesan).
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const q = req.query.search.trim();
    where.OR = [{ message: { contains: q } }, { device: { name: { contains: q } } }];
  }

  const sort = parseSort(req.query, Object.keys(ALERT_ORDER));
  const orderBy = sort ? [ALERT_ORDER[sort.key](sort.dir), { id: "asc" }] : [{ status: "asc" }, { triggeredAt: "desc" }];

  const [total, rows, c] = await Promise.all([
    prisma.deviceAlert.count({ where }),
    prisma.deviceAlert.findMany({
      where,
      include: {
        device: {
          select: { id: true, name: true, type: true, ipAddress: true, onlineStatus: true, building: { select: { name: true } } },
        },
        acknowledgedBy: { select: { fullName: true } },
      },
      // Bawaan: aktif (belum ditandai) paling atas, lalu yang terbaru.
      orderBy,
      skip,
      take,
    }),
    getAlertCounts(),
  ]);

  return res.json({
    data: rows, total, page, pageSize,
    counts: { active: c.active, critical: c.critical, acknowledged: c.acknowledged, resolved: c.resolved },
  });
}

async function acknowledge(req, res) {
  const id = Number(req.params.id);
  const alert = await prisma.deviceAlert.findUnique({ where: { id }, include: { device: { select: { name: true } } } });
  if (!alert) return res.status(404).json({ error: "Peringatan tidak ditemukan" });
  if (alert.status === "RESOLVED") return res.status(400).json({ error: "Peringatan ini sudah pulih" });
  if (alert.status === "ACKNOWLEDGED") return res.json(alert);

  // Atomik: hanya berhasil bila statusnya masih ACTIVE (tidak menimpa peringatan yang baru saja pulih/ditandai).
  const r = await prisma.deviceAlert.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: req.user.id },
  });
  const updated = await prisma.deviceAlert.findUnique({ where: { id } });
  if (r.count === 0) return res.json(updated);

  await logActivity(req.user.id, `Menandai peringatan "${alert.message}" pada perangkat "${alert.device.name}" sebagai diketahui`);
  return res.json(updated);
}

// Tandai semua peringatan aktif sekaligus.
async function acknowledgeAll(req, res) {
  const r = await prisma.deviceAlert.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: req.user.id },
  });
  if (r.count > 0) await logActivity(req.user.id, `Menandai ${r.count} peringatan aktif sebagai diketahui`);
  return res.json({ acknowledged: r.count });
}

module.exports = { summary, listAlerts, acknowledge, acknowledgeAll };
