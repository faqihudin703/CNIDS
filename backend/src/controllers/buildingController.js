const prisma = require("../config/prisma");
const { logActivity } = require("../utils/activityLogger");
const { listAreasWithStatus, validateParent } = require("../services/areaService");

// Area/gedung berbentuk pohon (parentId). Validasi bentuk data ada di validators/buildingValidators.js.
async function listBuildings(req, res) {
  return res.json(await listAreasWithStatus());
}

async function createBuilding(req, res) {
  const parentError = await validateParent(req.body.parentId ?? null, null);
  if (parentError) return res.status(400).json({ error: parentError });

  const building = await prisma.building.create({
    data: {
      name: req.body.name,
      code: req.body.code ?? null,
      description: req.body.description ?? null,
      topologyMapUrl: req.body.topologyMapUrl ?? null,
      parentId: req.body.parentId ?? null,
    },
  });
  await logActivity(req.user.id, `Menambahkan area/gedung baru "${building.name}"`);
  return res.status(201).json(building);
}

async function updateBuilding(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.building.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Area/gedung tidak ditemukan" });

  if (req.body.parentId !== undefined) {
    const parentError = await validateParent(req.body.parentId, id);
    if (parentError) return res.status(400).json({ error: parentError });
  }

  const building = await prisma.building.update({ where: { id }, data: req.body });
  await logActivity(req.user.id, `Memperbarui data area/gedung "${building.name}"`);
  return res.json(building);
}

async function deleteBuilding(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.building.findUnique({
    where: { id },
    include: { _count: { select: { devices: true, children: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Area/gedung tidak ditemukan" });

  // Relasi memakai onDelete: SetNull — perangkat menjadi "tanpa area" dan sub-area naik ke tingkat teratas.
  await prisma.building.delete({ where: { id } });
  await logActivity(
    req.user.id,
    `Menghapus area/gedung "${existing.name}" (${existing._count.devices} perangkat menjadi tanpa area, ${existing._count.children} sub-area naik ke tingkat teratas)`
  );
  return res.status(204).send();
}

module.exports = { listBuildings, createBuilding, updateBuilding, deleteBuilding };
