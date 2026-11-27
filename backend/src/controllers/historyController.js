const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { parsePagination } = require("../utils/pagination");

async function addHistory(req, res) {
  const { eventType, description } = req.body;
  const entry = await prisma.deviceHistory.create({ data: { deviceId: req.device.id, eventType, description } });
  await logActivity(req.user.id, `Mencatat riwayat "${eventType}" pada perangkat "${req.device.name}"`);
  return res.status(201).json(entry);
}

// Dibatasi per halaman (default 100) — riwayat satu perangkat bisa sangat panjang.
async function listHistory(req, res) {
  const { skip, take } = parsePagination(req.query, { defaultSize: 100, maxSize: 500 });
  const history = await prisma.deviceHistory.findMany({
    where: { deviceId: req.device.id },
    orderBy: { recordedAt: "desc" },
    skip,
    take,
  });
  return res.json(history);
}

module.exports = { addHistory, listHistory };
