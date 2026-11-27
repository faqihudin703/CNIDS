const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { withPool } = require("../utils/ipPool");
const { resolveAllForDevice } = require("../services/alertSync");
const { parsePagination } = require("../utils/pagination");
const deviceService = require("../services/deviceService");
const { runCheckForDevice } = require("../services/monitoringService");
const logger = require("../config/logger");

// Ping pertama dilakukan saat itu juga (bukan menunggu jadwal), lalu perangkat dibaca ulang agar respons memuat status barunya.
async function checkNowAndReload(device) {
  try {
    await runCheckForDevice(device);
    return (await prisma.device.findUnique({ where: { id: device.id } })) || device;
  } catch (err) {
    logger.warn({ deviceId: device.id, err: err.message }, "Ping pertama setelah simpan gagal");
    return device;
  }
}

async function listDevices(req, res) {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const { rows, total, counts, facets } = await deviceService.listDevices(req.query, req.user.role, { skip, take });
  return res.json({ data: rows, total, page, pageSize, counts, facets });
}

async function getDevice(req, res) {
  const device = await deviceService.getDeviceDetail(Number(req.params.id), req.user.role);
  if (!device) return res.status(404).json({ error: "Perangkat tidak ditemukan" });
  if (device.ports) device.ports = device.ports.map(withPool);
  return res.json(device);
}

async function ensureBuilding(buildingId, res) {
  if (!buildingId) return true;
  if (!(await prisma.building.findUnique({ where: { id: buildingId }, select: { id: true } }))) {
    res.status(400).json({ error: "Area/gedung tidak ditemukan" });
    return false;
  }
  return true;
}

// 409 dengan menyebut perangkat pemilik SN, supaya admin langsung tahu mana yang bentrok.
async function ensureSerialFree(serialNumber, exceptId, res) {
  const owner = await deviceService.findSerialOwner(serialNumber, exceptId);
  if (!owner) return true;
  res.status(409).json({ error: `Serial number "${serialNumber}" sudah dipakai perangkat "${owner.name}" (ID ${owner.id}). Satu SN hanya boleh untuk satu perangkat.` });
  return false;
}

async function createDevice(req, res) {
  if (!(await ensureBuilding(req.body.buildingId, res))) return;
  if (!(await ensureSerialFree(req.body.serialNumber, null, res))) return;

  let device = await prisma.device.create({ data: { ...req.body, createdById: req.user.id } });
  await logActivity(req.user.id, `Menambahkan perangkat baru "${device.name}" (ID ${device.id})`);
  if (device.monitorMethod === "ICMP") device = await checkNowAndReload(device);
  return res.status(201).json(device);
}

async function updateDevice(req, res) {
  const data = req.body;
  const existing = req.device; // dimuat oleh middleware loadDevice
  if (!(await ensureBuilding(data.buildingId, res))) return;
  if (!(await ensureSerialFree(data.serialNumber, existing.id, res))) return;

  let device = await prisma.$transaction(async (tx) => {
    const updated = await tx.device.update({ where: { id: existing.id }, data });
    // Pemantauan dimatikan -> peringatan yang masih terbuka tidak relevan lagi.
    if (data.monitorMethod === "NONE" && existing.monitorMethod !== "NONE") {
      await resolveAllForDevice(tx, existing.id);
    }
    return updated;
  });

  await logActivity(req.user.id, `Memperbarui data perangkat "${device.name}" (ID ${device.id})`);
  // Pemantauan baru dinyalakan atau IP-nya berubah -> langsung ping, status tidak menunggu jadwal.
  const needsCheck = device.monitorMethod === "ICMP" && (existing.monitorMethod !== "ICMP" || existing.ipAddress !== device.ipAddress);
  if (needsCheck) device = await checkNowAndReload(device);
  return res.json(device);
}

// Pindahkan beberapa perangkat sekaligus ke satu area (atau ke "tanpa area" bila buildingId null).
async function bulkMove(req, res) {
  const { ids, buildingId } = req.body;

  let targetName = "Tanpa area";
  if (buildingId) {
    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { name: true } });
    if (!building) return res.status(400).json({ error: "Area/gedung tujuan tidak ditemukan" });
    targetName = building.name;
  }

  const result = await prisma.device.updateMany({ where: { id: { in: ids } }, data: { buildingId } });
  await logActivity(req.user.id, `Memindahkan ${result.count} perangkat ke area "${targetName}"`);
  return res.json({ moved: result.count });
}

async function deleteDevice(req, res) {
  await deviceService.deleteDevice(req.device.id);
  await logActivity(req.user.id, `Menghapus perangkat "${req.device.name}" (ID ${req.device.id})`);
  return res.status(204).send();
}

module.exports = { listDevices, getDevice, createDevice, updateDevice, bulkMove, deleteDevice };
