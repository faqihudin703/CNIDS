// Validasi konfigurasi saat start. Gagal cepat lebih baik daripada berjalan dengan secret lemah.

function validateEnv(env = process.env, { exit = true } = {}) {
  const errors = [];
  const warnings = [];
  const production = env.NODE_ENV === "production";

  if (!env.DATABASE_URL) errors.push("DATABASE_URL belum diatur");

  if (production && env.COOKIE_SECURE === "false") {
    warnings.push("COOKIE_SECURE=false di production: cookie sesi bisa terkirim lewat HTTP biasa");
  }
  if (String(env.COOKIE_SAMESITE).toLowerCase() === "none" && env.COOKIE_SECURE === "false") {
    errors.push("COOKIE_SAMESITE=none mensyaratkan cookie Secure (HTTPS)");
  }

  if (production && !env.CORS_ORIGIN) {
    errors.push("CORS_ORIGIN wajib diatur di production (daftar origin frontend, dipisah koma)");
  } else if (!env.CORS_ORIGIN) {
    warnings.push("CORS_ORIGIN belum diatur: semua origin diizinkan (hanya untuk development)");
  }

  if (exit && errors.length) {
    for (const e of errors) console.error(`[config] ${e}`);
    process.exit(1);
  }
  return { errors, warnings };
}

module.exports = { validateEnv };
