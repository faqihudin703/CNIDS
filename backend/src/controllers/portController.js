const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { withPool } = require("../utils/ipPool");
const { checkPortRules, has } = require("../utils/portRules");
const portService = require("../services/portService");

// Natural sort supaya Gi0/2 tampil sebelum Gi0/10 (bukan urutan alfabet biasa).
function naturalSort(a, b) {
  return a.interfaceName.localeCompare(b.interfaceName, undefined, { numeric: true, sensitivity: "base" });
}

function rulesFailed(res, errors, fieldPrefix = "") {
  return res.status(400).json({
    error: "Validasi gagal",
    details: errors.map((e) => ({ field: fieldPrefix + e.field, message: e.message })),
  });
}

// Satu perangkat paling banyak memiliki ratusan port, jadi diurutkan natural di memori; paginasi dilakukan setelahnya.
async function listPorts(req, res) {
  const { page, pageSize } = req.query;
  const allPorts = (await prisma.devicePort.findMany({ where: { deviceId: req.device.id } })).sort(naturalSort).map(withPool);

  // Paginasi opsional: tanpa parameter, kembalikan semua (frontend memakainya untuk search/filter).
  if (!page) return res.json({ data: allPorts, total: allPorts.length });

  const take = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const skip = Math.max(Number(page) - 1, 0) * take;
  return res.json({ data: allPorts.slice(skip, skip + take), total: allPorts.length });
}

async function createPort(req, res) {
  const errors = checkPortRules(req.body);
  if (errors.length) return rulesFailed(res, errors);

  const port = await portService.createPort(req.device.id, req.body);
  await logActivity(req.user.id, `Menambahkan port "${port.interfaceName}" pada perangkat "${req.device.name}"`);
  return res.status(201).json(withPool(port));
}

async function bulkCreatePorts(req, res) {
  // Seluruh batch ditolak jika ada satu port yang melanggar aturan, supaya tidak ada yang masuk setengah-setengah.
  for (let i = 0; i < req.body.ports.length; i++) {
    const errors = checkPortRules(req.body.ports[i]);
    if (errors.length) return rulesFailed(res, errors, `ports.${i}.`);
  }

  const created = await portService.bulkCreatePorts(req.device.id, req.body.ports);
  await logActivity(req.user.id, `Menambahkan ${created} port sekaligus pada perangkat "${req.device.name}"`);
  return res.status(201).json({ created, requested: req.body.ports.length });
}

async function generatePorts(req, res) {
  const { namePrefix, start, end, portMode, vlan } = req.body;
  const errors = checkPortRules({ portMode, vlan });
  if (errors.length) return rulesFailed(res, errors);

  const result = await portService.generatePorts(req.device.id, req.body);
  await logActivity(
    req.user.id,
    `Membuat ${result.created} port (${namePrefix}${start}-${namePrefix}${end}, mode ${portMode}) pada perangkat "${req.device.name}"`
  );
  return res.status(201).json(result);
}

async function updatePort(req, res) {
  const portId = Number(req.params.portId);
  const existing = await prisma.devicePort.findUnique({ where: { id: portId }, include: { device: { select: { name: true } } } });
  if (!existing) return res.status(404).json({ error: "Port tidak ditemukan" });

  const body = req.body;
  const mode = body.portMode ?? existing.portMode;
  const merged = { ...existing, ...body, portMode: mode };

  // Saat mode berpindah, nilai lama yang tidak berlaku di mode baru dikosongkan otomatis (mis. Access -> Trunk
  // menghapus IP/prefix tersimpan), kecuali klien sengaja mengirimnya — itu tetap ditolak oleh checkPortRules.
  if (mode === "TRUNK") {
    if (!has(body.ipInterface)) merged.ipInterface = null;
    if (!has(body.prefix)) merged.prefix = null;
  }
  if (mode === "NO_VLAN" && !has(body.vlan)) merged.vlan = null;

  const errors = checkPortRules(merged);
  if (errors.length) return rulesFailed(res, errors);

  const port = await portService.updatePort(portId, merged);
  await logActivity(req.user.id, `Memperbarui port "${port.interfaceName}" pada perangkat "${existing.device.name}"`);
  return res.json(withPool(port));
}

async function deletePort(req, res) {
  const portId = Number(req.params.portId);
  const existing = await prisma.devicePort.findUnique({ where: { id: portId }, include: { device: { select: { name: true } } } });
  if (!existing) return res.status(404).json({ error: "Port tidak ditemukan" });

  await portService.deletePort(portId);
  await logActivity(req.user.id, `Menghapus port "${existing.interfaceName}" dari perangkat "${existing.device.name}"`);
  return res.status(204).send();
}

module.exports = { listPorts, createPort, bulkCreatePorts, generatePorts, updatePort, deletePort };
