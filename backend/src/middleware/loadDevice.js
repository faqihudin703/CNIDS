const prisma = require("../config/prisma");

/**
 * Memuat perangkat dari :id ke req.device (404 bila tidak ada). Dipasang di route SEBELUM middleware upload,
 * sehingga file tidak ditulis ke disk untuk perangkat yang tidak ada.
 */
async function loadDevice(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: "Perangkat tidak ditemukan" });

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return res.status(404).json({ error: "Perangkat tidak ditemukan" });

  req.device = device;
  next();
}

module.exports = { loadDevice };
