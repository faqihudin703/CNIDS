// pm2: jalankan dari folder backend dengan `pm2 start ecosystem.config.js && pm2 save`.
// Nilai rahasia (DATABASE_URL, CORS_ORIGIN, dst.) dibaca dari .env di folder ini.
module.exports = {
  apps: [
    {
      name: "cnids-backend",
      script: "src/server.js",
      cwd: __dirname,
      instances: 1, // wajib 1: penjadwal ping ada di dalam proses, lebih dari 1 = ping dan peringatan ganda
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        BIND_HOST: "127.0.0.1", // hanya diakses lewat Nginx di server yang sama
      },
    },
  ],
};
