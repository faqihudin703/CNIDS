const express = require("express");
const router = express.Router();

const { login, logout, me } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loginSchema } = require("../utils/validators/authValidators");
const { loginIpLimiter, loginUserLimiter } = require("../middleware/rateLimit");

// Limiter dipasang SEBELUM validasi/bcrypt agar serangan tebak password tidak membebani CPU.
router.post("/login", loginIpLimiter, validateBody(loginSchema), loginUserLimiter, login);

// Logout tidak memakai authenticate: sesi yang sudah kedaluwarsa pun tetap bisa dibersihkan.
router.post("/logout", logout);

// Tidak ada pendaftaran mandiri. Akun dibuat/dikelola Superadmin lewat /api/users.
router.get("/me", authenticate, me);

module.exports = router;
