const prisma = require("../config/prisma");
const logger = require("../config/logger");

/**
 * Mencatat satu baris ke activity_logs.
 * Dipanggil eksplisit di controller setelah aksi tulis (create/update/delete)
 * berhasil, bukan lewat middleware generik, supaya pesan log tetap deskriptif
 * dan sesuai konteks masing-masing aksi.
 */
async function logActivity(userId, action) {
  try {
    await prisma.activityLog.create({
      data: { userId: userId ?? null, action },
    });
  } catch (err) {
    // Kegagalan mencatat log tidak boleh menggagalkan request utama.
    logger.error({ err }, "Gagal mencatat activity log");
  }
}

module.exports = { logActivity };
