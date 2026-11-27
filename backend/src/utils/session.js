const crypto = require("crypto");
const prisma = require("../config/prisma");

const COOKIE_NAME = "cnids_sid";
const TTL_HOURS = () => Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 8);

// Yang dikirim ke browser adalah token acak 256-bit; yang disimpan di database hanya hash SHA-256-nya,
// sehingga bocornya tabel sessions tidak memberi penyerang sesi yang bisa dipakai.
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function cookieOptions() {
  const sameSite = ["lax", "strict", "none"].includes(String(process.env.COOKIE_SAMESITE).toLowerCase())
    ? String(process.env.COOKIE_SAMESITE).toLowerCase()
    : "lax";
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production" || sameSite === "none";
  return { sameSite, secure };
}

function serializeCookie(value, maxAgeSec) {
  const { sameSite, secure } = cookieOptions();
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/api",
    "HttpOnly",
    `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
    `Max-Age=${maxAgeSec}`,
    secure ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

function readSessionToken(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === COOKIE_NAME) {
      const v = part.slice(i + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
    }
  }
  return null;
}

async function createSession(res, user, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  const ttlMs = TTL_HOURS() * 3600 * 1000;
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + ttlMs),
      ip: req.ip ? String(req.ip).slice(0, 45) : null,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 255) || null,
    },
  });
  res.setHeader("Set-Cookie", serializeCookie(token, Math.floor(ttlMs / 1000)));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie("", 0));
}

const revokeUserSessions = (userId) => prisma.session.deleteMany({ where: { userId } });

module.exports = { COOKIE_NAME, hashToken, readSessionToken, createSession, clearSessionCookie, revokeUserSessions };
