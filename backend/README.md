# CNIDS Backend

Backend untuk **CNIDS** (Centralized Network Infrastructure Documentation System) —
Sistem Dokumentasi Infrastruktur Jaringan Terpusat, dikembangkan sebagai proyek
Kerja Praktik untuk UPPTIK, UIN Siber Syekh Nurjati Cirebon.

## Prasyarat

- Node.js 22 LTS atau lebih baru
- MariaDB atau MySQL (versi 10.6+ / 8.0+) yang sudah berjalan
- Akses internet (dibutuhkan sekali saat `prisma generate`/`migrate` untuk
  mengunduh query engine Prisma)

## Setup Awal

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Siapkan file environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` dan sesuaikan minimal dua hal ini:

   | Variabel | Keterangan |
   |---|---|
   | `DATABASE_URL` | Connection string ke MariaDB, format `mysql://user:pass@host:3306/nama_db` |
   | `CORS_ORIGIN` | Origin frontend, mis. `http://localhost` (wajib di production). Login memakai cookie sehingga origin harus spesifik. |

3. **Buat database** (jika belum ada)

   ```sql
   CREATE DATABASE cnids_db CHARACTER SET utf8mb4;
   ```

4. **Generate Prisma Client & jalankan migrasi**

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

   Perintah ini akan membuat seluruh tabel (`users`, `buildings`, `devices`,
   `device_photos`, `device_history`, `device_configs`, `status_checks`,
   `activity_logs`) sesuai `prisma/schema.prisma`.

5. **Seed data awal** (akun admin pertama + contoh gedung)

   ```bash
   npm run seed
   ```

   Seed membuat tiga akun awal, satu per peran: `superadmin`, `admin`, dan `user`
   (password bawaan `ChangeMe123!`, bisa diatur lewat env `SEED_SUPERADMIN_PASSWORD`,
   `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD`). **Segera login sebagai superadmin dan
   atur ulang semua password ini** — lihat bagian [Keamanan](#catatan-keamanan) di bawah.

6. **Jalankan server**

   ```bash
   npm run dev      # development, auto-reload (node --watch bawaan Node 22, tanpa nodemon)
   # atau
   npm start        # production
   ```

   Server berjalan di `http://localhost:4000` (atau sesuai `PORT` di `.env`).
   Cek `GET /health` untuk memastikan server hidup.

## Struktur Proyek

```
prisma/
  schema.prisma       Skema database (users, buildings, devices, ip_pools, device_ports, foto, riwayat, config, status, log)
  seed.js             Data awal: 3 akun (superadmin, admin, user) + contoh area & sub-area
  backfill-pools.js   Mengisi pool_id port lama (npm run backfill:pools)
src/
  config/             Setup Prisma client, logger (Pino), Multer (upload), validasi env
  routes/             Definisi endpoint + urutan middleware (tanpa logika, tanpa akses DB)
  middleware/         Auth (sesi cookie + RBAC), CSRF, loadDevice, validasi (Zod), upload check, rate limit, error handler
  controllers/        Lapisan HTTP tipis: baca request -> panggil service -> tulis respons + catat aktivitas
  services/           Logika bisnis + akses database (satu file per domain)
    deviceService       Daftar/detail/hapus perangkat (filter, hitung per status, hapus file fisik)
    portService         Port + pool IP (semua dalam transaksi)
    poolService         Pool bersama: cari/buat pool unik, bersihkan pool yatim
    ipamService         Daftar IP dan agregasi pool
    areaService         Pohon area + status per area, validasi induk (anti siklus)
    dashboardService    Ringkasan dashboard (umum & admin)
    alertSync           Keputusan buka/tutup peringatan (fungsi murni + penerapan ke DB)
    alertService        Hitungan peringatan (1 query groupBy)
    monitoringService   Ping ICMP, status On/Off/Never On, transaksi per pengecekan, konkurensi terbatas
    scheduler           Penjadwal cek status otomatis (opsional, default nonaktif)
    maintenance         Pembersihan data lama (retensi) secara bertahap
  utils/              Helper murni tanpa efek samping bisnis
    validators/         Skema Zod per resource (+ common.js untuk bagian yang dipakai bersama)
    constants.js        Konstanta domain (status peringatan terbuka, status On/Off/Never On)
    pagination.js       Parsing page/pageSize dengan batas aman
    concurrency.js      mapWithConcurrency (batasi pekerjaan paralel)
    areaTree.js         Turunan area & deteksi siklus (1 query)
    fileStore.js        Path upload aman + hapus file
    ipPool.js, portRules.js, roles.js, session.js, activityLogger.js, activityVisibility.js
  app.js              Perakitan Express app + middleware
  server.js           Entry point
```

## Peran Pengguna (RBAC)

Sistem punya tiga peran dengan hierarki: peran yang lebih tinggi otomatis
memiliki semua hak peran di bawahnya.

| Peran | Label di UI | Hak akses |
|---|---|---|
| `USER` | User | Hanya lihat informasi non-sensitif: nama perangkat, lokasi, IP, riwayat. Field `notes` disaring oleh backend (bukan hanya disembunyikan di frontend). Tidak bisa melihat port (VLAN & tujuan koneksi), IPAM, backup konfigurasi, maupun log aktivitas. |
| `ADMIN` | Admin Jaringan | Semua hak User, plus kelola dokumentasi: perangkat, port, gedung, riwayat, foto, backup konfigurasi, monitoring ping, IPAM, dan lihat log aktivitas. |
| `SUPERADMIN` | Superadmin | Semua hak Admin, plus kelola akun (`/api/users`): tambah, ubah peran, nonaktifkan, atur ulang password, hapus. |

Aturan pengelolaan akun (hanya Superadmin):

- Tidak ada pendaftaran mandiri dan tidak ada endpoint register publik.
- Superadmin tidak bisa mengubah peran, menonaktifkan, atau menghapus **akunnya sendiri**,
  sehingga selalu tersisa minimal satu Superadmin aktif.
- Akun yang sudah tercatat sebagai pembuat perangkat tidak bisa dihapus (menjaga jejak audit);
  nonaktifkan saja.
- Middleware `authenticate` mengecek status dan peran terbaru ke database di setiap request,
  jadi akun yang dinonaktifkan atau diturunkan perannya langsung kehilangan akses tanpa
  menunggu token lama kedaluwarsa.

## Modul Monitoring (Pelengkap, Ping Saja)

Modul ini **opsional per perangkat** dan hanya melakukan ping (ICMP). Set
`monitorMethod` suatu device ke `ICMP` (dan isi alamat IP-nya) untuk
mengaktifkan. Untuk monitoring yang lebih dalam, gunakan Zabbix/Grafana.

Scheduler otomatis **aktif secara default** (matikan dengan `ENABLE_MONITORING_SCHEDULER=false`). Tiap 10 detik ia
memeriksa perangkat ber-monitoring mana yang jeda pingnya sudah lewat, lalu mem-ping-nya. **Jeda ping diatur per
perangkat** (`pingIntervalSec`, 10 detik s/d 24 jam, bawaan 300 detik = 5 menit) lewat form perangkat. Ping manual:
`POST /api/devices/:id/status/check` (satu device; respons `{ check, device }` memuat status On/Off terbaru) atau
`POST /api/monitoring/check-all` (semua device ber-monitoring, mengabaikan jeda).

Status langsung berubah: ping pertama dijalankan **saat perangkat disimpan** (perangkat baru ber-ICMP, ICMP baru
dinyalakan, atau IP berubah), dan frontend memuat ulang diam-diam tiap 5 detik (daftar & detail perangkat) / 10 detik
(dashboard & peringatan), jadi hasil ping terjadwal tampil tanpa refresh.

### Validasi IP & MAC
- **IP manajemen**: hanya angka dan titik (IPv4, 4 bagian 0-255); kolom di frontend langsung membuang huruf/simbol
  saat diketik. Kosong disimpan `null`.
- **MAC address**: hanya angka 0-9 dan huruf A-F (12 karakter). Format apa pun (`aabbccddeeff`, `aa-bb-...`) disimpan
  `AA:BB:CC:DD:EE:FF`; frontend memformatnya otomatis saat diketik.
- `PATCH /api/devices/:id` kini benar-benar parsial: field yang tidak dikirim tidak lagi dikembalikan ke nilai bawaan
  (sebelumnya jenis/pemantauan bisa tereset ke `LAINNYA`/`NONE`).

Migrasi kolom jeda ping: `npx prisma migrate dev --name device_ping_interval`, lalu `npx prisma generate` dan restart
backend (perangkat lama otomatis mendapat 300 detik).

## Port Perangkat

Satu perangkat dapat memiliki banyak port (puluhan). Tiap port wajib punya **mode**, dan mode
menentukan field mana yang berlaku:

| Mode | VLAN | IP interface + prefix (CIDR) | IP pool |
|---|---|---|---|
| `TRUNK` | wajib (boleh lebih dari satu, mis. `10,20,30`) | tidak boleh ada | tidak ada |
| `ACCESS` | wajib | opsional, harus diisi berpasangan | otomatis bila IP + prefix ada |
| `NO_VLAN` (port biasa) | tidak boleh ada | opsional, harus diisi berpasangan | otomatis bila IP + prefix ada |

Field lain: `interfaceName` (wajib, unik per perangkat, mis. `Gi0/1`) dan `description`.
Tidak ada lagi field status port maupun pool manual.

**IP pool ditentukan otomatis** dari IP interface + prefix dan dikembalikan sebagai field turunan
`pool` (`cidr`, `network`, `broadcast`, `firstHost`, `lastHost`, `hosts`, `range`). Detail pool
(range, jumlah host) selalu dihitung dari IP + prefix; yang disimpan hanya identitas pool.
**Pool yang sama tidak menumpuk**: tabel `ip_pools` punya unique `(network, prefix_length)`, sehingga
`192.168.10.5/24` dan `192.168.10.77/24` memakai satu baris pool yang sama (`device_ports.pool_id`).
Pool yang tidak dipakai port mana pun dibersihkan otomatis. Contoh: `192.168.10.5` + `/24` menghasilkan pool `192.168.10.1 - 192.168.10.254` (254 host).
`/31` memakai kedua alamatnya (RFC 3021) dan `/32` satu alamat.

Saat mode diubah (mis. Access ke Trunk), nilai lama yang tidak berlaku otomatis dikosongkan.
Mengirim IP/prefix ke port Trunk, atau VLAN ke port Tanpa VLAN, ditolak dengan HTTP 400.

Untuk perangkat dengan puluhan port, tersedia dua jalan pintas:

- `POST /api/devices/:id/ports/generate` — buat rentang sekaligus, mis.
  `{"namePrefix":"Gi0/","start":1,"end":48,"portMode":"ACCESS","vlan":"10"}` membuat Gi0/1 s.d. Gi0/48.
  IP tidak diisi massal karena bersifat unik per port.
- `POST /api/devices/:id/ports/bulk` — kirim array port (maks. 200 per request; satu port melanggar
  aturan membuat seluruh batch ditolak).

Nama interface yang sudah ada dilewati. `GET /api/devices/:id/ports` mendukung paginasi opsional
lewat `?page=&pageSize=`.

## IPAM (Alamat IP)

`GET /api/ipam` mengagregasi seluruh `DevicePort.ipInterface` yang terisi, lintas semua perangkat:
IP, prefix, perangkat, port, **IP pool (otomatis)**, VLAN, mode, dan keterangan. Mendukung
`?search=`, `?vlan=`, `?portMode=`, dan `?poolId=`. Port Trunk tidak punya IP sehingga tidak muncul.

`GET /api/ipam/pools` mengembalikan **daftar pool unik** beserta pemakaiannya: kapasitas host, jumlah IP
terpakai, persentase pemakaian, daftar perangkat, dan VLAN yang berada di pool itu.

## Data Perangkat & Status (gaya Ruijie Cloud)

Selain nama (alias), jenis, dan IP manajemen, perangkat menyimpan: `serialNumber` (SN, unik),
`vendor` (merek), `model` (tipe produk), `macAddress` (disimpan `AA:BB:CC:DD:EE:FF`, format input bebas),
`firmwareVersion`, `description` (deskripsi singkat), `installedAt`, dan `location` (lokasi presisi).
Viewer tidak menerima `notes`, `macAddress`, dan `firmwareVersion`.

**Status perangkat** (`onlineStatus`) mengikuti konsep Online / Offline / Not Online Yet di Ruijie Cloud:

| Status | Arti |
|---|---|
| `ON` | ping terakhir berhasil |
| `OFF` | pernah `ON`, tetapi ping terakhir gagal (`offlineSince` terisi) |
| `NEVER_ON` | belum pernah ping berhasil, atau ping belum diaktifkan |

Status diperbarui oleh modul ping (`monitorMethod = ICMP`); perangkat tanpa ping tetap `NEVER_ON`.
Tiap peralihan On <-> Off dicatat otomatis di riwayat perangkat (`eventType = STATUS`), padanan device log
Ruijie. `GET /api/devices` mendukung `?search=` (nama, SN, IP, model, merek, deskripsi, lokasi; MAC hanya untuk
admin), `?status=ON|OFF|NEVER_ON`, `?type=`, `?buildingId=` (ikut sub-area), `?unassigned=true`,
`?page=` dan `?pageSize=`; responsnya `{ data, total, page, pageSize, counts: { ALL, ON, OFF, NEVER_ON } }`.
`POST /api/devices/bulk-move` memindahkan banyak perangkat ke satu area sekaligus ("Move to").

## Peringatan (Warnings)

Padanan Warnings di Ruijie Cloud. Peringatan dibuat **otomatis** oleh modul ping (`utils/alertSync.js`) dan
hanya untuk perangkat dengan `monitorMethod = ICMP`:

| Jenis | Tingkat | Dibuka saat | Ditutup saat |
|---|---|---|---|
| `OFFLINE` | `CRITICAL` | perangkat yang pernah On gagal di-ping | ping berhasil lagi |
| `HIGH_LATENCY` | `WARNING` | ping berhasil tetapi latensi >= ambang (`ALERT_LATENCY_MS`, default 200 ms) | latensi normal, atau perangkat Off |

Perangkat yang belum pernah On (Never On) tidak menimbulkan peringatan karena bukan gangguan. Satu perangkat hanya
punya satu peringatan terbuka per jenis. Status: `ACTIVE` (baru) -> `ACKNOWLEDGED` (ditandai admin, kondisi masih
berlangsung) -> `RESOLVED` (pulih, ditutup otomatis). Mematikan pemantauan sebuah perangkat menutup peringatannya.
Endpoint peringatan khusus Admin/Superadmin. Peringatan hanya terbentuk jika scheduler aktif
(bawaan aktif) atau ping dipicu manual.

Migrasi: `npx prisma migrate dev --name device_alerts`, lalu `npx prisma generate` dan restart backend.

### Pengaturan peringatan (Superadmin)
Aturan pembuatan peringatan dapat diatur Superadmin dari halaman **Peringatan > Pengaturan peringatan** (tabel `alert_settings`,
satu baris), berlaku untuk semua perangkat mulai pengecekan ping berikutnya:

| Pengaturan | Isi | Bawaan |
|---|---|---|
| Peringatan Off aktif | hidup/mati | aktif |
| Ping gagal berturut-turut | 1-10 kali sebelum peringatan Off dibuka (anti gangguan sesaat) | 1 |
| Tingkat peringatan Off | Kritis / Peringatan | Kritis |
| Peringatan latensi aktif | hidup/mati | aktif |
| Ambang latensi | 10-10000 ms | `ALERT_LATENCY_MS` (200) |
| Tingkat peringatan latensi | Kritis / Peringatan | Peringatan |

Jenis yang dimatikan tidak dibuat lagi dan peringatannya yang masih terbuka ditutup pada pengecekan berikutnya. API:
`GET /api/alerts/settings` (Admin dan Superadmin, hanya baca) dan `PUT /api/alerts/settings` (hanya Superadmin, perubahan
dicatat di Log Aktivitas). Sebelum pertama kali disimpan dipakai nilai bawaan, sehingga perilaku lama tidak berubah.
Migrasi: `npx prisma migrate dev --name alert_settings`, lalu `npx prisma generate` dan restart backend.

## Lokasi & Area/Gedung

Area/gedung berbentuk **pohon** lewat `parentId` (mis. Gedung > Ruang Server), mirip Device Group di Ruijie
Cloud. `GET /api/buildings` mengembalikan daftar datar + `statusCounts` (On/Off/Never On) per area dan
`unassigned`; frontend menyusun pohonnya dan menjumlahkan sub-area. Area tidak bisa dipindahkan ke dalam
dirinya sendiri atau sub-areanya. Menghapus area (`DELETE /api/buildings/:id`) tidak menghapus
perangkatnya (menjadi "tanpa area"), dan sub-area naik ke tingkat teratas.

## Dashboard

`GET /api/dashboard` (semua peran) mengembalikan ringkasan untuk halaman awal. Semua peran mendapat
jumlah perangkat, sebaran status On/Off/Never On, sebaran per area dan jenis, serta perangkat terbaru. Bagian `admin` (jumlah port & IP,
mode port, status ping terakhir, kelengkapan dokumentasi, aktivitas terbaru) hanya dikirim ke
Admin/Superadmin.

## Visibilitas Log Aktivitas

Log yang dilakukan oleh akun **Superadmin** hanya terlihat oleh Superadmin. Admin melihat semua log
selain itu (termasuk di `/api/activity-logs` dan panel aktivitas dashboard).

## Catatan Migrasi: revisi gaya Ruijie Cloud

Revisi ini menambah kolom pada `devices` (SN, vendor, model, MAC, firmware, deskripsi, status, dst.),
`buildings.parent_id`, tabel `ip_pools`, dan `device_ports.pool_id`. Jalankan:

```bash
npx prisma migrate dev --name ruijie_style_devices_pools
npm run backfill:pools   # mengisi pool_id untuk port lama yang sudah punya IP + prefix
```

Perangkat lama otomatis berstatus `NEVER_ON` sampai ping aktif dan berhasil. Serial number kosong disimpan
sebagai `NULL` sehingga tidak bentrok dengan aturan unik.

## Catatan Migrasi (dari versi sebelumnya)

Perubahan skema ini menghapus kolom `pool` dan `status` dari `device_ports` dan membuat `port_mode`
wajib. Bila database sudah berisi port, jalankan sebelum `prisma migrate dev`:

```sql
UPDATE device_ports SET port_mode = 'NO_VLAN' WHERE port_mode IS NULL;
```

Port lama yang punya VLAN sebaiknya diubah ke mode Access/Trunk, dan port Trunk lama yang masih
menyimpan IP akan dibersihkan saat diubah lewat aplikasi.

## Ringkasan Endpoint

Semua endpoint (kecuali `/health` dan `/api/auth/login`) butuh cookie sesi `cnids_sid` (diset otomatis saat login) dan, untuk POST/PATCH/DELETE, header penanda CSRF:
```
X-Requested-With: CNIDS
```

| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | Publik | Login, server menerbitkan cookie sesi httpOnly |
| POST | `/api/auth/logout` | Semua | Logout, sesi dihapus di server |
| GET | `/api/auth/me` | Semua | Profil sendiri |
| GET | `/api/users` | Superadmin | Daftar akun (`?search=` `?role=`) |
| POST | `/api/users` | Superadmin | Buat akun (`username`, `password`, `fullName`, `role`) |
| PATCH | `/api/users/:id` | Superadmin | Ubah nama / peran / status aktif |
| POST | `/api/users/:id/reset-password` | Superadmin | Atur ulang password akun |
| DELETE | `/api/users/:id` | Superadmin | Hapus akun (tidak bisa jika sudah mencatat perangkat) |
| GET | `/api/devices` | Semua | Daftar perangkat + jumlah per status (`?search=` `?status=` `?type=` `?buildingId=` `?unassigned=` `?page=` `?pageSize=`) |
| POST | `/api/devices/bulk-move` | Admin | Pindahkan banyak perangkat ke satu area (`ids`, `buildingId`) |
| GET | `/api/devices/:id` | Semua | Detail perangkat |
| POST | `/api/devices` | Admin | Tambah perangkat |
| PATCH | `/api/devices/:id` | Admin | Ubah perangkat |
| DELETE | `/api/devices/:id` | Admin | Hapus perangkat |
| GET | `/api/devices/:id/ports` | Admin | Daftar port perangkat |
| POST | `/api/devices/:id/ports` | Admin | Tambah satu port |
| POST | `/api/devices/:id/ports/bulk` | Admin | Tambah banyak port (array) |
| POST | `/api/devices/:id/ports/generate` | Admin | Generate rentang port (prefix + nomor awal-akhir) |
| PATCH | `/api/devices/ports/:portId` | Admin | Ubah port |
| DELETE | `/api/devices/ports/:portId` | Admin | Hapus port |
| GET | `/api/devices/:id/history` | Semua | Riwayat perangkat |
| POST | `/api/devices/:id/history` | Admin | Tambah catatan riwayat |
| POST | `/api/devices/:id/photos` | Admin | Unggah foto (`multipart/form-data`, field `photo`) |
| DELETE | `/api/devices/photos/:photoId` | Admin | Hapus foto |
| POST | `/api/devices/:id/configs` | Admin | Unggah backup config (field `config`) |
| GET | `/api/devices/configs/:configId/download` | Admin | Unduh backup config |
| DELETE | `/api/devices/configs/:configId` | Admin | Hapus backup config |
| GET | `/api/devices/:id/status` | Semua | Status termutakhir |
| POST | `/api/devices/:id/status/check` | Admin | Trigger cek manual |
| GET | `/api/buildings` | Semua | Daftar area/gedung (datar, `parentId`, `statusCounts`) + `unassigned` |
| POST | `/api/buildings` | Admin | Tambah area/gedung (`name`, `code`, `description`, `parentId`) |
| PATCH | `/api/buildings/:id` | Admin | Ubah area/gedung (termasuk memindahkan induk) |
| DELETE | `/api/buildings/:id` | Admin | Hapus area/gedung (perangkat menjadi tanpa area) |
| GET | `/api/activity-logs` | Admin | Log audit, tanpa log milik Superadmin kecuali diakses Superadmin (`?page=` `?pageSize=`) |
| POST | `/api/monitoring/check-all` | Admin | Trigger cek semua perangkat termonitor |
| GET | `/api/ipam` | Admin | Daftar agregat seluruh IP dari port + pool otomatis (`?search=` `?vlan=` `?portMode=` `?poolId=`) |
| GET | `/api/ipam/pools` | Admin | Daftar pool unik + pemakaian, perangkat, VLAN (`?search=`) |
| GET | `/api/alerts` | Admin | Daftar peringatan (`?view=active`, `resolved`, atau `all`; `?severity=` `?type=` `?deviceId=` `?page=`) + `counts` |
| GET | `/api/alerts/summary` | Admin | Jumlah peringatan baru & kritis (badge menu) |
| POST | `/api/alerts/:id/acknowledge` | Admin | Tandai satu peringatan sebagai diketahui |
| POST | `/api/alerts/acknowledge-all` | Admin | Tandai semua peringatan baru sebagai diketahui |
| GET | `/api/dashboard` | Semua | Ringkasan dashboard (bagian `admin` hanya untuk Admin/Superadmin) |

Koleksi request siap-pakai tersedia di `cnids.postman_collection.json` —
import ke Postman/Insomnia/Thunder Client.

## Perintah Prisma yang Berguna

```bash
npx prisma studio          # GUI untuk lihat/edit data langsung
npx prisma migrate dev     # buat migrasi baru setelah ubah schema.prisma
npx prisma generate        # regenerate client setelah ubah schema.prisma
```

## Pengurutan (sort) di server

`GET /api/devices`, `/api/alerts` dan `/api/activity-logs` menerima `?sort=<kunci>&order=asc|desc`. Kunci dibatasi whitelist (kunci lain diabaikan, bukan error), jadi tidak bisa dipakai mengurutkan kolom sensitif.

| Endpoint | Kunci `sort` |
|---|---|
| `/devices` | `status`, `name`, `serialNumber`, `model`, `ipAddress`, `building`, `macAddress` (hanya admin) |
| `/alerts` | `severity`, `device`, `message`, `triggeredAt`, `status` |
| `/activity-logs` | `loggedAt`, `user`, `action` |

Urutan perangkat bersifat natural (AP-2 sebelum AP-10; IP per oktet) dan nilai kosong selalu di akhir. Tanpa `sort`, urutan bawaan tidak berubah.

## Serial number unik & pencarian dinamis

- **Satu SN = satu perangkat.** SN dirapikan otomatis (trim, spasi ganda jadi satu, HURUF BESAR; kosong menjadi `NULL`) lalu dicek di server sebelum disimpan. Bentrok menghasilkan `409` yang menyebut perangkat pemegang SN-nya; unique index database tetap menjadi pengaman terakhir untuk permintaan yang berbarengan. Untuk data lama jalankan sekali: `npm run normalize:serials` (merapikan SN dan melaporkan yang bentrok tanpa mengubahnya).
- **Pencarian mengikuti kolom yang tampil.** `GET /api/devices?search=` mencari di Nama, SN, Model, IP Manajemen, MAC (hanya admin), dan nama Area/Gedung. `/api/alerts?search=` mencari di Perangkat dan Peringatan; `/api/activity-logs?search=` di Pengguna dan Aksi.
- **Opsi filter dinamis.** Respons `/api/devices` memuat `facets.types` ([{ value, count }]) yang dihitung dari hasil saat ini (mengikuti pencarian, area, dan status), dipakai frontend untuk dropdown "Jenis". Filter `?type=` juga menyaring tab jumlah status.

## Database: performa & integritas

Hasil audit database (N+1, transaksi, indeks, pertumbuhan data). Dibuktikan oleh `npm test` -> `test/db.test.js`.

- **Tidak ada N+1.** Daftar area, perangkat, dashboard, IPAM, dan peringatan memakai jumlah query yang tetap (groupBy/`_count`/`include`), bukan query per baris. Hitungan peringatan dari 2–4 `count` menjadi 1 `groupBy`. Dashboard tidak lagi memuat riwayat ping seluruh perangkat: status monitoring dihitung dari kolom `onlineStatus`/`lastCheckedAt`.
- **Ping terkendali.** Cek status memakai konkurensi terbatas (`MONITOR_CONCURRENCY`, default 10) sehingga ratusan perangkat tidak menghabiskan pool koneksi database. Putaran yang tumpang tindih (jadwal vs tombol "cek semua") dilewati / dijawab 409.
- **Atomik.** Satu pengecekan perangkat (riwayat ping + status + peringatan + riwayat On/Off), operasi port + pool IP, hapus perangkat, dan ubah perangkat + tutup peringatan masing-masing satu transaksi. Update pertama mengunci baris perangkat sehingga dua pengecekan bersamaan tidak membuat peringatan ganda. Ping sendiri dilakukan di luar transaksi.
- **Anti balapan pool IP.** Pembersihan pool yatim melewati pool yang dibuat < 1 menit lalu. Konfirmasi peringatan memakai update kondisional (`status = ACTIVE`).
- **Retensi data.** `status_checks` (±288 baris/hari/perangkat) dihapus setelah `STATUS_RETENTION_DAYS` (default 30), peringatan yang sudah pulih setelah `ALERT_RETENTION_DAYS` (default 180), sesi kedaluwarsa tiap jam; penghapusan bertahap 5.000 baris. Log aktivitas belum dibatasi (kebijakan menunggu diskusi dengan UPPTIK).
- **File yatim.** Menghapus perangkat kini ikut menghapus file foto/konfigurasinya dari disk; upload yang gagal disimpan ke DB juga membersihkan filenya; route upload memeriksa perangkat dulu (sebelum file ditulis).
- **Indeks baru:** `device_history(device_id, recorded_at)`, `status_checks(checked_at)`, `devices(name)`.
- **Batas respons.** Riwayat di detail perangkat dibatasi 200 terbaru, `/history` berpaginasi, daftar IP maksimal 5.000 baris (`truncated: true` bila terpotong).
- **Diterima:** pencarian `LIKE '%kata%'` tidak bisa memakai indeks (scan penuh; aman hingga puluhan ribu perangkat, setelah itu pakai FULLTEXT). Daftar port satu perangkat diurutkan natural di memori. Atur ukuran pool dengan `?connection_limit=N` pada `DATABASE_URL` bila perlu.

## Keamanan

Hasil audit + hardening (dibuktikan oleh `npm test` -> `test/security.test.js`, 30 tes, Prisma di-stub sehingga tidak butuh database).

**Wajib diatur di `.env`**
- Tidak ada lagi `JWT_SECRET`. Atur `SESSION_TTL_HOURS` (default 8), `COOKIE_SAMESITE` (`lax` default; `none` hanya bila frontend beda domain dan wajib HTTPS) dan `COOKIE_SECURE` (otomatis true di production).
- `CORS_ORIGIN` (production wajib) = origin frontend, pisahkan dengan koma bila lebih dari satu.
- `TRUST_PROXY` isi `1` jika di belakang Nginx/Caddy supaya rate limit membaca IP asli.
- `BIND_HOST` (opsional) alamat bind server. Kosong = semua interface; `127.0.0.1` bila hanya diakses lewat reverse proxy di mesin yang sama. Jangan memakai nama `HOST` (sering sudah diisi oleh sistem/panel) dan jangan diisi IP publik yang tidak terpasang di server (`EADDRNOTAVAIL`).
- Ganti semua password bawaan seed. `npm run seed` menolak password default/pendek di production.
- Jangan commit `.env`.

**Yang sudah diterapkan**
- Rate limit: login 5 gagal / 15 menit per IP+username, 20 gagal / 15 menit per IP (anti password spraying), API umum 600 / menit.
- Autentikasi: sesi server-side (tabel `sessions`) dengan cookie `httpOnly` + `Secure` + `SameSite`, jadi JavaScript frontend tidak pernah memegang token dan localStorage tidak dipakai. Yang tersimpan di DB hanya hash SHA-256 token. Logout, reset password, dan penonaktifan akun mencabut sesi seketika; sesi kedaluwarsa dibersihkan tiap jam. Role selalu dibaca dari database.
- CSRF: request POST/PATCH/DELETE wajib membawa header `X-Requested-With`, dan header `Origin` (bila ada) harus termasuk `CORS_ORIGIN`.
- Login: pesan error sama untuk user tak ada / password salah / akun nonaktif, plus bcrypt dummy compare agar waktu respons seragam. Password maks 72 byte (batas bcrypt).
- Header `helmet`, `x-powered-by` dimatikan, body JSON maks 100 KB, JSON rusak -> 400, header cookie disensor di log.
- Upload: whitelist ekstensi, cek magic bytes (JPEG/PNG/WEBP; config harus teks tanpa byte NUL), file ditolak dihapus dari disk. Folder `/uploads/photos` disajikan `nosniff` + CSP `sandbox`; backup config tidak pernah disajikan statis.
- `topologyMapUrl` hanya http/https (cegah `javascript:`); IP divalidasi ketat (cegah injeksi argumen ping); validator membuang field di luar skema (mass assignment); tidak ada SQL mentah / eksekusi shell.
- Viewer tidak menerima notes/MAC/firmware, dan tidak bisa mencari lewat MAC.

**Migrasi untuk perubahan ini**
```bash
npx prisma migrate dev --name session_auth_and_indexes   # tabel sessions + indeks baru
npx prisma generate
npm install && npm test
```

**Risiko yang diterima / catatan**
- URL foto perangkat publik (tanpa login) agar bisa dimuat `<img>`; nama file acak, isi sudah divalidasi.
- Sesi bersifat absolut (habis setelah `SESSION_TTL_HOURS`, tidak diperpanjang otomatis). Cookie httpOnly mencegah pencurian sesi lewat XSS, tetapi XSS tetap bisa mengirim request atas nama pengguna selama halaman terbuka; frontend sudah diaudit tanpa sink XSS.
- `npm audit` bersih (0 advis). Advis `minimatch` hilang dengan mengganti nodemon ke `node --watch`; advis `deepmerge-ts` (CLI Prisma) ditutup lewat `overrides` ke deepmerge-ts 8 (pemuatan konfigurasi Prisma sudah diuji). Upgrade ke Prisma 7 (perubahan besar: driver adapter) dijadwalkan terpisah, lalu `overrides` bisa dihapus. Setelah `npx prisma generate`, restart server `npm run dev` (Prisma Client tidak ikut di-reload).
- Pasang HTTPS lewat reverse proxy di produksi (HSTS sudah dikirim helmet).

## Known Limitation (Rancangan Awal)

Sesuai proposal, hal-hal berikut masih bersifat rancangan awal dan terbuka
disesuaikan setelah diskusi dengan UPPTIK:

- Cakupan area/gedung yang didokumentasikan.
- Kebijakan retensi log aktivitas (saat ini disimpan tanpa batas waktu).
