const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { logActivity } = require("../utils/activityLogger");
const { hashToken, readSessionToken, createSession, clearSessionCookie } = require("../utils/session");

// Hash palsu: dibandingkan saat username tidak ada, agar waktu respons sama dengan username yang ada
// (mencegah penyingkapan username lewat selisih waktu).
const DUMMY_HASH = bcrypt.hashSync("tidak-pernah-dipakai", 12);

async function login(req, res) {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username } });

  // Pesan error disamakan untuk username tidak ditemukan maupun password salah,
  // supaya tidak membocorkan informasi username mana saja yang terdaftar.
  const invalidCredentials = () => {
    logger.warn({ ip: req.ip, username: String(username).slice(0, 50) }, "Login gagal");
    return res.status(401).json({ error: "Username atau password salah" });
  };

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !passwordMatches) {
    return invalidCredentials();
  }

  await createSession(res, user, req);

  await logActivity(user.id, `Login berhasil sebagai ${user.role}`);
  logger.info({ userId: user.id }, "User login");

  return res.json({
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
  });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, fullName: true, role: true, isActive: true, createdAt: true },
  });
  if (!user) {
    return res.status(404).json({ error: "Pengguna tidak ditemukan" });
  }
  return res.json(user);
}

async function logout(req, res) {
  const token = readSessionToken(req);
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  clearSessionCookie(res);
  return res.status(204).send();
}

module.exports = { login, logout, me };
