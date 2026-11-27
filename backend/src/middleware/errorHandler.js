const multer = require("multer");
const logger = require("../config/logger");

/**
 * Error handler terpusat. Ditempatkan paling akhir di app.js.
 * Menangani error Multer (upload) secara khusus, Prisma known errors secara umum,
 * dan fallback 500 untuk sisanya tanpa membocorkan stack trace ke client.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload gagal: ${err.message}` });
  }

  // Body JSON rusak / terlalu besar: kesalahan klien, bukan server.
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Format JSON tidak valid" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Ukuran permintaan terlalu besar" });

  // Parameter/query tidak valid (mis. id bukan angka, ?type=xyz, ?search=a&search=b) ditolak Prisma sebagai
  // validation error. Itu input klien yang salah -> 400, bukan 500.
  if (err.name === "PrismaClientValidationError") {
    logger.warn({ path: req.path }, "Parameter permintaan tidak valid");
    return res.status(400).json({ error: "Parameter permintaan tidak valid" });
  }

  // Error kustom dari fileFilter di config/upload.js
  if (err.message && err.message.startsWith("Tipe file tidak diizinkan")) {
    return res.status(400).json({ error: err.message });
  }

  // Prisma: pelanggaran unique constraint, foreign key, dsb.
  if (err.code && typeof err.code === "string" && err.code.startsWith("P")) {
    logger.warn({ code: err.code, meta: err.meta }, "Prisma error tertangani");
    if (err.code === "P2002") {
      const target = String(err.meta?.target ?? "");
      if (target.includes("serial_number")) {
        return res.status(409).json({ error: "Serial number sudah terdaftar pada perangkat lain" });
      }
      if (target.includes("code")) {
        return res.status(409).json({ error: "Kode area/gedung sudah dipakai" });
      }
      return res.status(409).json({ error: "Data sudah ada (duplikat)" });
    }
    if (err.code === "P2000") {
      return res.status(400).json({ error: "Salah satu isian terlalu panjang" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Data terkait tidak valid atau masih direferensikan data lain" });
    }
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  return res.status(500).json({ error: "Terjadi kesalahan pada server" });
}

module.exports = errorHandler;
