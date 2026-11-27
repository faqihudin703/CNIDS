require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const pinoHttp = require("pino-http");

const logger = require("./config/logger");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimit");
const { csrfProtection } = require("./middleware/csrf");

const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const buildingRoutes = require("./routes/buildingRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const ipamRoutes = require("./routes/ipamRoutes");
const alertRoutes = require("./routes/alertRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

// Di belakang reverse proxy (Nginx/Cloudflare Tunnel), IP klien asli ada di X-Forwarded-For. Aktifkan hanya bila
// memang ada proxy tepercaya (TRUST_PROXY=1), kalau tidak penyerang bisa memalsukan IP dan menghindari rate limit.
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(v) ? Number(v) : v === "true" ? true : v);
}

// Header keamanan standar (nosniff, HSTS, dst.). CORP "cross-origin" supaya frontend di origin lain tetap bisa
// menampilkan foto perangkat.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: daftar origin eksplisit lewat CORS_ORIGIN (dipisah koma). Autentikasi memakai cookie httpOnly, jadi
// credentials:true dan origin harus spesifik (tidak boleh "*"); CSRF ditangani middleware csrf.js.
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true, // tanpa CORS_ORIGIN (development): cerminkan origin pemanggil
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    maxAge: 600,
  })
);
app.use("/api", csrfProtection(allowedOrigins));

app.use(express.json({ limit: "100kb" }));

// Jangan pernah mencatat token/cookie ke log.
app.use(
  pinoHttp({
    logger,
    redact: { paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'], censor: "[REDACTED]" },
  })
);

app.use(apiLimiter);

// Foto perangkat disajikan sebagai static file (gambar untuk ditampilkan langsung di dashboard). Backup
// konfigurasi SENGAJA tidak disajikan lewat static serving — lihat configController.downloadConfig.
// Nama file acak 128-bit sehingga tidak bisa ditebak; nosniff + CSP ketat mencegah file disalahartikan sebagai HTML/skrip.
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./uploads");
app.use(
  "/uploads/photos",
  express.static(path.join(uploadRoot, "photos"), {
    index: false,
    dotfiles: "deny",
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox");
      res.setHeader("Cache-Control", "private, max-age=3600");
    },
  })
);

app.get("/health", (req, res) => res.json({ status: "ok", service: "cnids-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/ipam", ipamRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
});

app.use(errorHandler);

module.exports = app;
