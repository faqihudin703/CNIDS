const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const { revokeUserSessions } = require("../utils/session");
const { logActivity } = require("../utils/activityLogger");

const SALT_ROUNDS = 12;

// passwordHash tidak pernah ikut dikembalikan ke client.
const PUBLIC_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

async function listUsers(req, res) {
  const { search, role } = req.query;

  const where = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [{ username: { contains: search } }, { fullName: { contains: search } }];
  }

  const users = await prisma.user.findMany({
    where,
    select: { ...PUBLIC_SELECT, _count: { select: { devicesCreated: true } } },
    orderBy: { username: "asc" },
  });

  return res.json({ data: users, total: users.length });
}

async function createUser(req, res) {
  const { username, password, fullName, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return res.status(409).json({ error: "Username sudah digunakan" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { username, passwordHash, fullName, role },
    select: PUBLIC_SELECT,
  });

  await logActivity(req.user.id, `Membuat akun "${username}" dengan peran ${role}`);
  return res.status(201).json(user);
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  const { fullName, role, isActive } = req.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Pengguna tidak ditemukan" });
  }

  // Superadmin tidak boleh mengubah peran/menonaktifkan akunnya sendiri. Ini sekaligus
  // menjamin selalu ada minimal satu Superadmin aktif yang bisa mengelola akun lain.
  if (id === req.user.id) {
    if (role !== undefined && role !== existing.role) {
      return res.status(400).json({ error: "Tidak dapat mengubah peran akun Anda sendiri" });
    }
    if (isActive === false) {
      return res.status(400).json({ error: "Tidak dapat menonaktifkan akun Anda sendiri" });
    }
  }

  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;

  const user = await prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT });
  if (isActive === false) await revokeUserSessions(id);

  const changes = [];
  if (role !== undefined && role !== existing.role) changes.push(`peran ${existing.role} -> ${role}`);
  if (isActive !== undefined && isActive !== existing.isActive) {
    changes.push(isActive ? "diaktifkan" : "dinonaktifkan");
  }
  if (fullName !== undefined && fullName !== existing.fullName) changes.push("nama diubah");
  await logActivity(
    req.user.id,
    `Memperbarui akun "${existing.username}"${changes.length ? ": " + changes.join(", ") : ""}`
  );

  return res.json(user);
}

async function resetPassword(req, res) {
  const id = Number(req.params.id);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Pengguna tidak ditemukan" });
  }

  const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  // semua sesi akun ini dicabut: pemilik (atau penyerang yang mencuri sesi) harus login ulang dengan password baru
  await revokeUserSessions(id);

  await logActivity(req.user.id, `Mengatur ulang password akun "${existing.username}"`);
  return res.status(204).send();
}

async function deleteUser(req, res) {
  const id = Number(req.params.id);

  if (id === req.user.id) {
    return res.status(400).json({ error: "Tidak dapat menghapus akun Anda sendiri" });
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { devicesCreated: true } } },
  });
  if (!existing) {
    return res.status(404).json({ error: "Pengguna tidak ditemukan" });
  }

  // Perangkat menyimpan pembuatnya (relasi Restrict), jadi akun yang sudah mencatat
  // perangkat tidak bisa dihapus. Arahkan ke penonaktifan agar jejak audit tetap utuh.
  if (existing._count.devicesCreated > 0) {
    return res.status(409).json({
      error: `Akun ini tercatat sebagai pembuat ${existing._count.devicesCreated} perangkat, sehingga tidak dapat dihapus. Nonaktifkan akun ini sebagai gantinya.`,
    });
  }

  await prisma.user.delete({ where: { id } });
  await logActivity(req.user.id, `Menghapus akun "${existing.username}"`);
  return res.status(204).send();
}

module.exports = { listUsers, createUser, updateUser, resetPassword, deleteUser };
