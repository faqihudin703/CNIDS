const prisma = require("../config/prisma");
const { runCheckForDevice, runAllChecks } = require("../services/monitoringService");
const { logActivity } = require("../utils/activityLogger");

async function triggerCheck(req, res) {
  const device = req.device;
  if (device.monitorMethod === "NONE") {
    return res.status(400).json({ error: "Monitoring belum diaktifkan untuk perangkat ini" });
  }

  const check = await runCheckForDevice(device);
  await logActivity(req.user.id, `Menjalankan pengecekan status manual untuk "${device.name}"`);
  // Sertakan kondisi perangkat terbaru supaya tampilan langsung berubah (On/Off/Never On) tanpa memuat ulang halaman.
  const fresh = await prisma.device.findUnique({
    where: { id: device.id },
    select: { id: true, onlineStatus: true, lastOnlineAt: true, offlineSince: true, lastCheckedAt: true },
  });
  return res.json({ check, device: fresh });
}

async function triggerAllChecks(req, res) {
  const run = await runAllChecks();
  if (run.skipped) {
    return res.status(409).json({ error: "Pengecekan sebelumnya masih berjalan, coba lagi sebentar lagi" });
  }
  await logActivity(req.user.id, "Menjalankan pengecekan status untuk seluruh perangkat termonitor");
  return res.json({ message: "Pengecekan status dijalankan untuk seluruh perangkat termonitor", total: run.total, failed: run.failed });
}

async function getLatestStatus(req, res) {
  const latest = await prisma.statusCheck.findFirst({
    where: { deviceId: req.device.id },
    orderBy: { checkedAt: "desc" },
  });
  if (!latest) return res.status(404).json({ error: "Belum ada data status untuk perangkat ini" });
  return res.json(latest);
}

module.exports = { triggerCheck, triggerAllChecks, getLatestStatus };
