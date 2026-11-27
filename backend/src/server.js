require("dotenv").config();
const { validateEnv } = require("./config/env");

// Gagal cepat bila konfigurasi tidak aman (sebelum menerima request apa pun).
const envCheck = validateEnv();

const app = require("./app");
const logger = require("./config/logger");
const { startScheduler } = require("./services/scheduler");
const { purgeStaleData } = require("./services/maintenance");

const PORT = process.env.PORT || 4000;

// Tanpa HOST, Node mendengarkan di semua interface (:: / 0.0.0.0). Isi BIND_HOST=127.0.0.1 bila hanya boleh diakses
// lewat reverse proxy di mesin yang sama (nginx aaPanel), sehingga port backend tidak terbuka ke jaringan.
const HOST = process.env.BIND_HOST;
const onListening = () => {
  envCheck.warnings.forEach((w) => logger.warn(w));
  const a = server.address();
  logger.info(`CNIDS backend mendengarkan di ${a.address}:${a.port}`);

  // Pembersihan data yang tumbuh terus (ping lama, peringatan pulih, sesi kedaluwarsa) saat start lalu tiap jam.
  const purge = () =>
    purgeStaleData()
      .then((r) => (r.statusChecks || r.alerts || r.sessions) && logger.info(r, "Pembersihan data lama"))
      .catch((e) => logger.warn({ err: e.message }, "Gagal membersihkan data lama"));
  purge();
  setInterval(purge, 3600 * 1000).unref();

  // Modul monitoring bersifat pelengkap (lihat Proposal Bab 2.3). Aktif secara bawaan agar status berubah otomatis
  // setelah ping; matikan dengan ENABLE_MONITORING_SCHEDULER=false di .env.
  if (process.env.ENABLE_MONITORING_SCHEDULER !== "false") {
    startScheduler();
  }
};
const server = HOST ? app.listen(PORT, HOST) : app.listen(PORT);
server.once("listening", onListening);
// Gagal bind (port dipakai proses lain, HOST salah, dst.): catat penyebab sebenarnya lalu keluar.
server.once("error", (err) => {
  logger.error({ code: err.code, port: PORT, host: HOST || "(semua interface)" }, `Gagal listen: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown supaya koneksi Prisma ditutup rapi saat container/proses dihentikan.
process.on("SIGTERM", () => {
  logger.info("SIGTERM diterima, menutup server...");
  server.close(() => process.exit(0));
});
