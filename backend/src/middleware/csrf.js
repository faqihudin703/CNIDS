// Perlindungan CSRF untuk autentikasi berbasis cookie. Dua lapis:
// 1) request yang mengubah data wajib membawa header X-Requested-With. Form/<img> lintas situs tidak bisa
//    menyetelnya, dan fetch/XHR lintas origin memicu preflight CORS yang ditolak untuk origin tak dikenal.
// 2) bila header Origin ada, harus termasuk CORS_ORIGIN. Ini penting karena SameSite tidak membedakan port
//    (localhost:16497 dan localhost:25468 dianggap satu situs).
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfProtection(allowedOrigins) {
  return (req, res, next) => {
    if (SAFE.has(req.method)) return next();
    if (!req.get("x-requested-with")) {
      return res.status(403).json({ error: "Permintaan ditolak (header keamanan tidak ada)" });
    }
    const origin = req.get("origin");
    if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: "Permintaan ditolak (origin tidak diizinkan)" });
    }
    next();
  };
}

module.exports = { csrfProtection };
