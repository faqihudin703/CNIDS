const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const logger = require("../config/logger");

const tooMany = (message) => (req, res) =>
  res.status(429).json({ error: message });

// Seluruh API: batas kasar per IP supaya satu klien tidak menghabiskan server.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_API_PER_MIN) || 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tooMany("Terlalu banyak permintaan, coba lagi sebentar lagi"),
});

// Login, lapis 1: per IP (hanya percobaan GAGAL yang dihitung).
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN_PER_IP) || 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, "Login diblokir: terlalu banyak percobaan gagal dari IP");
    return res.status(429).json({ error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit" });
  },
});

// Login, lapis 2: per kombinasi IP + username. Kombinasi (bukan username saja) dipilih agar penyerang
// tidak bisa mengunci akun admin sungguhan dari IP lain.
const loginUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN_PER_USER) || 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.username ?? "").toLowerCase().slice(0, 50)}`,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, username: String(req.body?.username ?? "").slice(0, 50) }, "Login diblokir: percobaan gagal berulang");
    return res.status(429).json({ error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit" });
  },
});

module.exports = { apiLimiter, loginIpLimiter, loginUserLimiter };
