const cron = require("node-cron");
const logger = require("../config/logger");
const { runDueChecks } = require("./monitoringService");

/**
 * Penjadwal ping per perangkat. Setiap 10 detik scheduler memeriksa perangkat ber-monitoring ICMP mana yang jeda
 * pingIntervalSec-nya sudah lewat (diatur per perangkat di form, 10 dtk - 24 jam, bawaan 5 menit) lalu mem-ping-nya.
 * Aktif secara bawaan; matikan dengan ENABLE_MONITORING_SCHEDULER=false. Modul ini pelengkap, bukan inti sistem.
 */
function startScheduler() {
  cron.schedule("*/10 * * * * *", async () => {
    try {
      await runDueChecks();
    } catch (err) {
      logger.error({ err }, "Jadwal pengecekan status otomatis gagal");
    }
  });

  logger.info("Scheduler ping per perangkat aktif (cek tiap 10 detik, jeda sesuai pengaturan perangkat)");
}

module.exports = { startScheduler };
