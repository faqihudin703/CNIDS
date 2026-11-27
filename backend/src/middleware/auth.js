const prisma = require("../config/prisma");
const { ROLE_LEVEL, roleLevel } = require("../utils/roles");
const { hashToken, readSessionToken, clearSessionCookie } = require("../utils/session");

/**
 * Memverifikasi sesi dari cookie httpOnly (cnids_sid), lalu mengecek akun ke database.
 * Sesi disimpan di server (tabel sessions), jadi bisa dicabut seketika: logout, reset password,
 * atau penonaktifan akun menghapus sesinya. Peran dan status aktif selalu diambil terbaru dari DB.
 */
async function authenticate(req, res, next) {
  const token = readSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: "Belum login" });
  }

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { id: true, username: true, role: true, isActive: true } },
    },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    clearSessionCookie(res);
    return res.status(401).json({ error: "Sesi telah berakhir, silakan login kembali" });
  }

  const user = session.user;
  if (!user || !user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    clearSessionCookie(res);
    return res.status(401).json({ error: "Akun tidak aktif atau tidak ditemukan" });
  }

  // catat aktivitas terakhir paling sering sekali per 5 menit (hindari tulis DB di tiap request)
  if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

/**
 * Pembatas peran berbasis hierarki. Dipakai setelah authenticate().
 * requireRole("ADMIN") berarti "ADMIN atau lebih tinggi" (termasuk SUPERADMIN);
 * requireRole("SUPERADMIN") hanya Superadmin.
 */
function requireRole(...allowedRoles) {
  const minLevel = Math.min(...allowedRoles.map((r) => ROLE_LEVEL[r] ?? Infinity));
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Belum terautentikasi" });
    }
    if (roleLevel(req.user.role) < minLevel) {
      return res.status(403).json({ error: "Anda tidak memiliki akses untuk aksi ini" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
