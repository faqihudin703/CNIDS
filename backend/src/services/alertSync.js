const { OPEN_ALERT_STATUSES: OPEN_STATUSES } = require("../utils/constants");

const { defaultSettings } = require("./alertSettingsService");

/**
 * Keputusan murni (tanpa database): dari hasil ping dan pengaturan, peringatan apa yang harus dibuka/ditutup.
 *  - DOWN pada perangkat yang pernah On -> buka OFFLINE setelah `offlineAfterFailures` ping gagal berturut-turut; tutup HIGH_LATENCY
 *  - DOWN pada perangkat yang belum pernah On ("Never On") -> tidak ada peringatan (bukan gangguan)
 *  - UP -> tutup OFFLINE; latensi >= ambang membuka HIGH_LATENCY, kalau tidak menutupnya
 *  - UNKNOWN (tanpa IP) -> tidak ada perubahan
 *  - Jenis peringatan yang dimatikan Superadmin tidak dibuka lagi, dan yang masih terbuka ditutup pada pengecekan berikutnya
 * `consecutiveDown` = jumlah ping gagal berturut-turut TERMASUK ping ini.
 */
function decideAlerts({ pingStatus, latencyMs, everOnline, openTypes, consecutiveDown = 1, settings = defaultSettings() }) {
  const open = [];
  const resolve = [];
  const isOpen = (t) => openTypes.includes(t);
  const wantOffline = settings.offlineEnabled;
  const threshold = settings.latencyThresholdMs;

  if (!wantOffline && isOpen("OFFLINE") && pingStatus !== "UNKNOWN") resolve.push("OFFLINE");
  if (!settings.latencyEnabled && isOpen("HIGH_LATENCY") && pingStatus !== "UNKNOWN") resolve.push("HIGH_LATENCY");

  if (pingStatus === "DOWN") {
    if (everOnline) {
      if (wantOffline && !isOpen("OFFLINE") && consecutiveDown >= settings.offlineAfterFailures) {
        const n = settings.offlineAfterFailures;
        open.push({
          type: "OFFLINE",
          severity: settings.offlineSeverity,
          message: n > 1 ? `Perangkat tidak merespons ping (Off, ${n} kali berturut-turut)` : "Perangkat tidak merespons ping (Off)",
        });
      }
      if (isOpen("HIGH_LATENCY") && !resolve.includes("HIGH_LATENCY")) resolve.push("HIGH_LATENCY");
    }
  } else if (pingStatus === "UP") {
    if (isOpen("OFFLINE") && !resolve.includes("OFFLINE")) resolve.push("OFFLINE");
    if (settings.latencyEnabled && latencyMs != null && latencyMs >= threshold) {
      if (!isOpen("HIGH_LATENCY")) {
        open.push({
          type: "HIGH_LATENCY",
          severity: settings.latencySeverity,
          message: `Latensi ping tinggi: ${latencyMs} ms (ambang ${threshold} ms)`,
        });
      }
    } else if (isOpen("HIGH_LATENCY") && !resolve.includes("HIGH_LATENCY")) {
      resolve.push("HIGH_LATENCY");
    }
  }
  return { open, resolve };
}

// Jumlah ping gagal berturut-turut (terbaru dulu) dari riwayat ping; ping saat ini sudah tersimpan sebelum fungsi ini dipanggil.
async function countConsecutiveDown(db, deviceId, needed) {
  const recent = await db.statusCheck.findMany({
    where: { deviceId },
    orderBy: { checkedAt: "desc" },
    take: needed,
    select: { status: true },
  });
  let n = 0;
  for (const r of recent) {
    if (r.status !== "DOWN") break;
    n++;
  }
  return n;
}

// Menerapkan keputusan ke database. `everOnline` harus berasal dari kondisi perangkat SEBELUM ping ini.
async function syncAlerts(db, device, pingStatus, latencyMs, now = new Date(), settings = defaultSettings()) {
  const existing = await db.deviceAlert.findMany({
    where: { deviceId: device.id, status: { in: OPEN_STATUSES } },
    select: { type: true },
  });
  const needStreak = pingStatus === "DOWN" && settings.offlineEnabled && settings.offlineAfterFailures > 1;
  const { open, resolve } = decideAlerts({
    pingStatus,
    latencyMs,
    everOnline: Boolean(device.lastOnlineAt),
    openTypes: existing.map((a) => a.type),
    consecutiveDown: needStreak ? await countConsecutiveDown(db, device.id, settings.offlineAfterFailures) : 1,
    settings,
  });

  if (open.length) {
    await db.deviceAlert.createMany({ data: open.map((a) => ({ deviceId: device.id, triggeredAt: now, ...a })) });
  }
  if (resolve.length) {
    await db.deviceAlert.updateMany({
      where: { deviceId: device.id, type: { in: resolve }, status: { in: OPEN_STATUSES } },
      data: { status: "RESOLVED", resolvedAt: now },
    });
  }
  return { opened: open.length, resolved: resolve.length };
}

// Menutup semua peringatan terbuka suatu perangkat (mis. saat pemantauannya dimatikan).
async function resolveAllForDevice(db, deviceId, now = new Date()) {
  const r = await db.deviceAlert.updateMany({
    where: { deviceId, status: { in: OPEN_STATUSES } },
    data: { status: "RESOLVED", resolvedAt: now },
  });
  return r.count;
}

module.exports = { decideAlerts, syncAlerts, resolveAllForDevice, OPEN_STATUSES };
