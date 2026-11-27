const path = require("path");
const fs = require("fs");
const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { resolveUpload, removeUpload } = require("../utils/fileStore");

// Nama asli dari klien tidak dipercaya: buang karakter kontrol dan pemisah path, batasi panjang.
function safeFileName(name) {
  const base = path.basename(String(name || "config.txt")).replace(/[\u0000-\u001f\u007f"\\/]/g, "_");
  return base.slice(0, 200) || "config.txt";
}

async function uploadConfig(req, res) {
  if (!req.file) return res.status(400).json({ error: "File konfigurasi wajib disertakan" });

  const fileUrl = `/uploads/configs/${req.file.filename}`;
  let config;
  try {
    config = await prisma.deviceConfig.create({
      data: { deviceId: req.device.id, fileUrl, fileName: safeFileName(req.file.originalname) },
    });
  } catch (err) {
    await removeUpload(fileUrl); // simpan ke DB gagal -> jangan tinggalkan file yatim di disk
    throw err;
  }

  await logActivity(req.user.id, `Mengunggah backup konfigurasi untuk perangkat "${req.device.name}"`);
  return res.status(201).json(config);
}

// Endpoint unduh terpisah (bukan static file server) supaya setiap akses
// tetap melewati authenticate() + requireRole("ADMIN") dan tercatat di log.
async function downloadConfig(req, res) {
  const configId = Number(req.params.configId);

  const config = await prisma.deviceConfig.findUnique({ where: { id: configId } });
  if (!config) {
    return res.status(404).json({ error: "File konfigurasi tidak ditemukan" });
  }

  const filePath = resolveUpload(config.fileUrl);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File fisik tidak ditemukan di server" });
  }

  await logActivity(req.user.id, `Mengunduh backup konfigurasi "${config.fileName}" (ID ${configId})`);

  return res.download(filePath, config.fileName);
}

async function deleteConfig(req, res) {
  const configId = Number(req.params.configId);

  const config = await prisma.deviceConfig.findUnique({ where: { id: configId } });
  if (!config) {
    return res.status(404).json({ error: "File konfigurasi tidak ditemukan" });
  }

  await prisma.deviceConfig.delete({ where: { id: configId } });
  await removeUpload(config.fileUrl);

  await logActivity(req.user.id, `Menghapus backup konfigurasi (ID ${configId})`);

  return res.status(204).send();
}

module.exports = { uploadConfig, downloadConfig, deleteConfig };
