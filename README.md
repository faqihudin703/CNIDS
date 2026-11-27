# CNIDS – Centralized Network Infrastructure Documentation System

Aplikasi web untuk mendokumentasikan dan memantau infrastruktur jaringan UPPTIK/Pustikom UIN Siber Syekh Nurjati Cirebon. Ini versi **biasa**: dijalankan langsung dengan Node.js (tanpa Docker dan tanpa GitHub Actions).

## Fitur

- Inventaris perangkat dengan validasi: IP hanya IPv4, MAC hanya heksadesimal, serial number unik per perangkat.
- Pencarian dan filter dinamis, pengurutan tabel, dashboard ringkasan.
- Tiga peran: **Mahasiswa/Dosen** (lihat), **Admin** (kelola), **Superadmin** (kelola akun dan pengaturan peringatan).
- Monitoring ICMP dengan interval ping per perangkat (10 detik sampai 24 jam). Status berubah segera setelah ping.
- Peringatan offline dan latensi tinggi; aturan dan ambang diatur Superadmin.
- Sesi httpOnly di database, proteksi CSRF, rate limit, upload foto dan backup konfigurasi.

## Struktur

```
backend/    Express + Prisma + MariaDB (ecosystem.config.js untuk pm2)
frontend/   React + Vite + Tailwind
.nvmrc      Node 22
```

## Kebutuhan

Node 22 (`nvm use`), MariaDB 10.6+ atau MySQL 8, dan perintah `ping` di server.

## A. Development lokal

```bash
# backend
cd backend && cp .env.example .env      # isi DATABASE_URL, dll.
npm ci && npx prisma db push && npm run seed && npm run dev

# frontend (terminal lain)
cd frontend && cp .env.example .env     # VITE_API_URL=http://localhost:4000
npm ci && npm run dev
```

Tes: `npm test` di masing-masing folder (backend 68 tes, frontend 13 tes).

## B. Produksi (server Linux, Nginx + pm2)

**1. Backend**

```bash
cd backend && cp .env.example .env       # isi sesuai tabel variabel di bawah
npm ci --omit=dev
npx prisma generate && npx prisma db push
node prisma/seed.js                      # sekali, untuk akun awal (butuh SEED_*_PASSWORD di .env)
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```

**2. Frontend.** `npm run build` memakai `frontend/.env.production` (`VITE_API_URL=` kosong), sehingga frontend memanggil `/api` di alamat yang sama.

```bash
cd frontend && npm ci && npm run build
# salin ISI folder dist/ ke root situs, mis. /www/wwwroot/cnids/
```

**3. Nginx.** Pada config situs (aaPanel: Website → situs → Config), isi `root` dengan folder yang langsung berisi `index.html`, dan `proxy_pass` dengan port backend di `.env`:

```nginx
server {
    listen 80;
    server_name cnids.example.com;          # atau IP server
    root /www/wwwroot/cnids;
    index index.html;
    client_max_body_size 12m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # di belakang Cloudflare: $http_x_forwarded_proto
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }
    location / { try_files $uri /index.html; }
}
```

Lalu `nginx -t && nginx -s reload`.

Hanya satu instance backend yang boleh jalan: penjadwal ping ada di dalam proses. Setelah mengubah `.env` atau `ecosystem.config.js`, gunakan `pm2 delete cnids-backend` lalu `pm2 start ecosystem.config.js` (`pm2 restart` bisa membawa env lama).

**Pembaruan versi:** timpa kode, `cd backend && npm ci --omit=dev && npx prisma generate && npx prisma db push`, `pm2 restart cnids-backend`, lalu build ulang frontend dan salin `dist/`.

## Variabel penting (`backend/.env`)

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | `mysql://user:password@host:3306/nama_db` |
| `PORT`, `BIND_HOST` | Port backend; `BIND_HOST=127.0.0.1` bila hanya lewat Nginx (kosong = semua interface). Jangan pakai nama `HOST`, sering sudah diisi sistem |
| `CORS_ORIGIN` | Alamat **persis** seperti di address bar (dengan `:port` bila bukan 80/443), tanpa `/` di akhir. Wajib di production |
| `COOKIE_SECURE` | `false` untuk HTTP, `true` untuk HTTPS. Bila kosong di production, dianggap `true` sehingga login lewat HTTP tidak tersimpan |
| `TRUST_PROXY` | Jumlah proxy di depan backend (`1` = Nginx; `2` = Nginx + Cloudflare) |
| `ENABLE_MONITORING_SCHEDULER` | `true` (bawaan) menjalankan ping terjadwal; `false` untuk mematikan |
| `ALERT_LATENCY_MS` | Ambang latensi bawaan; dapat diubah Superadmin dari halaman Peringatan |
| `SEED_*_PASSWORD` | Password akun awal (min. 12 karakter), dipakai `npm run seed` |

## HTTPS

Tanpa domain: akses lewat IP/HTTP (`COOKIE_SECURE=false`). Dengan domain di Cloudflare: DNS *proxied* ke port 80 dengan mode **Flexible** (tanpa sertifikat di server; jangan aktifkan *Force HTTPS* di aaPanel agar tidak looping), lalu `CORS_ORIGIN=https://...`, `COOKIE_SECURE=true`, `TRUST_PROXY=2`.

## Catatan

- **Skema database:** belum ada folder `prisma/migrations`, jadi skema dibuat dengan `prisma db push`. Jika kamu membuat migrasi (`npx prisma migrate dev --name init`), commit foldernya dan pakai `migrate deploy` di server; pada database yang sudah ada jalankan dulu `npx prisma migrate resolve --applied init`.
- **Ping ICMP:** hanya perangkat yang terjangkau dari jaringan server yang bisa dipantau. Bila semua tampil offline, tes `ping <ip>` dari server.
- **Data:** foto dan backup konfigurasi ada di `UPLOAD_DIR` (bawaan `backend/uploads`), database di MariaDB. Backup rutin keduanya: `mysqldump -u <user> -p <db> > backup.sql`.
- **Masalah umum:** dashboard blank atau login memuat terus biasanya karena `/api` belum di-proxy ke backend (respons berupa HTML) atau frontend dibangun dengan `VITE_API_URL` berisi localhost. Cek: `curl -i http://<alamat>/api/dashboard` harus `401` dengan `application/json`. Port dipakai proses lain: `EADDRINUSE`; `EADDRNOTAVAIL` berarti `BIND_HOST` berisi IP yang tidak terpasang di server.

Dokumentasi API dan modul lengkap ada di `backend/README.md`.