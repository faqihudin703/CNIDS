const ping = require("ping");
const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { syncAlerts } = require("./alertSync");
const { getAlertSettings } = require("./alertSettingsService");
const { mapWithConcurrency } = require("../utils/concurrency");

/**
 * Modul monitoring PELENGKAP — hanya ping (ICMP).
 * Dijalankan untuk perangkat dengan monitorMethod = ICMP dan memiliki alamat IP.
 * Untuk monitoring yang lebih dalam, gunakan tools khusus (Zabbix/Grafana).
 *
 * Hasil ping juga menentukan status perangkat ala Ruijie Cloud:
 *   ON       : ping terakhir berhasil
 *   OFF      : pernah ON, tetapi ping terakhir gagal
 *   NEVER_ON : belum pernah ping berhasil (termasuk perangkat yang belum dicek)
 */

async function checkIcmp(ipAddress) {
  const result = await ping.promise.probe(ipAddress, { timeout: 3 });
  return {
    status: result.alive ? "UP" : "DOWN",
    latencyMs: result.alive ? Math.round(Number(result.time)) : null,
  };
}

// Menentukan perubahan field status perangkat dari hasil ping. Dipisah agar mudah diuji.
function nextOnlineState(device, pingStatus, now = new Date()) {
  if (pingStatus === "UP") {
    return {
      changes: { onlineStatus: "ON", lastOnlineAt: now, offlineSince: null, lastCheckedAt: now },
      transition: device.onlineStatus === "OFF" ? "ON" : null,
    };
  }
  if (pingStatus === "DOWN") {
    // Belum pernah ON -> tetap "Never On", bukan "Off".
    if (!device.lastOnlineAt) {
      return { changes: { onlineStatus: "NEVER_ON", lastCheckedAt: now }, transition: null };
    }
    return {
      changes: { onlineStatus: "OFF", offlineSince: device.offlineSince ?? now, lastCheckedAt: now },
      transition: device.onlineStatus === "ON" ? "OFF" : null,
    };
  }
  return { changes: { lastCheckedAt: now }, transition: null }; // UNKNOWN: status tidak diubah
}

// Transaksi interaktif: batas tunggu/eksekusi diperlonggar karena banyak perangkat dicek bergantian.
const TX_OPTIONS = { maxWait: 15000, timeout: 15000 };

/**
 * Satu pengecekan perangkat. Ping dilakukan DI LUAR transaksi (lambat, sampai 3 dtk) supaya koneksi DB tidak
 * ditahan; semua penulisan hasilnya (riwayat ping, status perangkat, peringatan, riwayat On/Off) atomik dalam
 * satu transaksi. Update pertama mengunci baris perangkat, jadi dua pengecekan bersamaan untuk perangkat yang
 * sama (jadwal + tombol manual) berjalan berurutan dan tidak membuat peringatan ganda.
 */
async function runCheckForDevice(device) {
  if (device.monitorMethod !== "ICMP") return null;

  const result = device.ipAddress
    ? await checkIcmp(device.ipAddress)
    : { status: "UNKNOWN", latencyMs: null }; // tanpa IP tidak bisa di-ping
  const now = new Date();
  const settings = await getAlertSettings(); // dibaca di luar transaksi agar tidak menahan dua koneksi DB sekaligus

  return prisma.$transaction(async (tx) => {
    // `fresh` = kondisi perangkat SEBELUM ping ini, dibaca setelah baris terkunci (bukan snapshot lama dari pemanggil).
    const fresh = await tx.device.update({ where: { id: device.id }, data: { lastCheckedAt: now } });
    if (fresh.monitorMethod !== "ICMP") return null; // pemantauan dimatikan saat ping berjalan

    const check = await tx.statusCheck.create({
      data: { deviceId: device.id, status: result.status, latencyMs: result.latencyMs, checkedAt: now },
    });

    const { changes, transition } = nextOnlineState(fresh, result.status, now);
    await tx.device.update({ where: { id: device.id }, data: changes });
    await syncAlerts(tx, fresh, result.status, result.latencyMs, now, settings);

    // Peralihan On <-> Off dicatat otomatis di riwayat perangkat (padanan device log Ruijie).
    if (transition) {
      await tx.deviceHistory.create({
        data: {
          deviceId: device.id,
          eventType: "STATUS",
          description: transition === "ON" ? "Perangkat kembali On (ping berhasil)" : "Perangkat Off (ping gagal)",
          recordedAt: now,
        },
      });
    }
    return check;
  }, TX_OPTIONS);
}

let running = false;

/** Perangkat yang sudah waktunya di-ping: belum pernah dicek, atau jeda pingIntervalSec sudah lewat sejak pengecekan terakhir. */
function isDue(device, now = new Date()) {
  if (!device.lastCheckedAt) return true;
  const interval = Math.max(1, Number(device.pingIntervalSec) || 300) * 1000;
  return now.getTime() - new Date(device.lastCheckedAt).getTime() >= interval - 500; // toleransi 0,5 dtk
}

const DEVICE_SELECT = { id: true, name: true, ipAddress: true, monitorMethod: true, pingIntervalSec: true, lastCheckedAt: true };

/** Ping sekumpulan perangkat dengan konkurensi terbatas (MONITOR_CONCURRENCY, default 10); kegagalan satu perangkat tidak menghentikan yang lain. */
async function checkMany(devices) {
  const limit = Math.max(1, Number(process.env.MONITOR_CONCURRENCY) || 10);
  const results = await mapWithConcurrency(devices, limit, runCheckForDevice);
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed++;
      logger.error({ deviceId: devices[i].id, err: r.reason }, "Gagal menjalankan ping perangkat");
    }
  });
  return failed;
}

/**
 * Dipanggil scheduler tiap beberapa detik: hanya ping perangkat yang jedanya sudah lewat, sehingga tiap perangkat punya
 * jadwal sendiri (pingIntervalSec). Bila putaran sebelumnya belum selesai, putaran ini dilewati (tidak menumpuk).
 */
async function runDueChecks(now = new Date()) {
  if (running) return { skipped: true, total: 0, failed: 0 };
  running = true;
  try {
    const all = await prisma.device.findMany({ where: { monitorMethod: "ICMP" }, select: DEVICE_SELECT });
    const due = all.filter((d) => isDue(d, now));
    if (due.length === 0) return { skipped: false, total: 0, failed: 0 };
    logger.info({ due: due.length, monitored: all.length }, "Ping terjadwal per perangkat");
    return { skipped: false, total: due.length, failed: await checkMany(due) };
  } finally {
    running = false;
  }
}

/** Ping SEMUA perangkat ber-monitoring ICMP sekarang juga, tanpa menunggu jeda (tombol "Cek semua"). */
async function runAllChecks() {
  if (running) return { skipped: true, total: 0, failed: 0 };
  running = true;
  try {
    const devices = await prisma.device.findMany({ where: { monitorMethod: "ICMP" }, select: DEVICE_SELECT });
    logger.info({ count: devices.length }, "Menjalankan ping untuk perangkat dengan monitoring aktif");
    return { skipped: false, total: devices.length, failed: await checkMany(devices) };
  } finally {
    running = false;
  }
}

module.exports = { runCheckForDevice, runAllChecks, runDueChecks, isDue, nextOnlineState };
