const { z } = require("zod");
const { optionalBuildingId, optionalText } = require("./common");

const deviceTypeEnum = z.enum(["ROUTER", "SWITCH", "ACCESS_POINT", "SERVER", "FIREWALL", "LAINNYA"]);
const monitorMethodEnum = z.enum(["NONE", "ICMP"]);

const ipAddressRegex =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

// IP manajemen: hanya angka dan titik (IPv4, 4 oktet 0-255). Spasi/tab di ujung dibuang (baris baru TIDAK, tetap ditolak), kosong -> null.
const optionalIp = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const t = v.replace(/^[ \t]+|[ \t]+$/g, "");
    return t === "" ? null : t;
  },
  z.string().regex(ipAddressRegex, "IP harus berupa angka dan titik, contoh 192.168.1.10 (tiap bagian 0-255)").nullable()
);

// Jeda ping per perangkat dalam detik: 10 dtk sampai 24 jam.
const PING_INTERVAL_MIN = 10;
const PING_INTERVAL_MAX = 86400;
const pingIntervalSchema = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number({ error: "Jeda ping harus berupa angka (detik)" })
    .int("Jeda ping harus bilangan bulat (detik)")
    .min(PING_INTERVAL_MIN, `Jeda ping minimal ${PING_INTERVAL_MIN} detik`)
    .max(PING_INTERVAL_MAX, "Jeda ping maksimal 24 jam (86400 detik)")
);

// MAC address: hanya angka 0-9 dan huruf A-F (heksadesimal), 12 digit. Terima AA:BB:CC:DD:EE:FF, AA-BB-..., atau aabb.ccdd.eeff, simpan sebagai AA:BB:CC:DD:EE:FF.
const optionalMac = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return null;
    const hex = v.trim().replace(/[:\-.]/g, "").toUpperCase();
    return /^[0-9A-F]{12}$/.test(hex) ? hex.match(/.{2}/g).join(":") : v;
  },
  z.string().regex(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/, "MAC harus 12 karakter angka 0-9 dan huruf A-F, contoh 00:D0:F8:12:34:56").nullable()
);

const optionalDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.date({ error: "Tanggal tidak valid" }).nullable()
);

// Serial number: rapikan (trim, spasi ganda -> satu, HURUF BESAR) agar "abc 123" dan "ABC  123" dianggap SN yang sama,
// dan string kosong menjadi null (null boleh banyak, string kosong tidak).
const optionalSerial = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().replace(/\s+/g, " ").toUpperCase()) : v),
  z.string().max(64, "Serial number maksimal 64 karakter").nullable()
);

// Bentuk field perangkat TANPA nilai bawaan. Create menambah bawaan; update memakai partial() murni, jadi PATCH yang hanya
// mengirim sebagian field tidak diam-diam mengembalikan jenis/pemantauan/jeda ping ke nilai bawaan.
const deviceFields = {
  name: z.string().min(1, "Nama perangkat wajib diisi").max(150),
  type: deviceTypeEnum,
  buildingId: optionalBuildingId,
  location: z.string().max(255, "Lokasi maksimal 255 karakter"),
  serialNumber: optionalSerial,
  vendor: optionalText(80, "Merek"),
  model: optionalText(100, "Model"),
  macAddress: optionalMac,
  firmwareVersion: optionalText(100, "Versi firmware"),
  description: optionalText(255, "Deskripsi"),
  installedAt: optionalDate,
  ipAddress: optionalIp,
  monitorMethod: monitorMethodEnum,
  pingIntervalSec: pingIntervalSchema,
  notes: z.string(),
};

const createDeviceSchema = z.object({
  ...Object.fromEntries(Object.entries(deviceFields).map(([k, f]) => [k, k === "name" ? f : f.optional()])),
  type: deviceTypeEnum.default("LAINNYA"),
  monitorMethod: monitorMethodEnum.default("NONE"),
  pingIntervalSec: pingIntervalSchema.default(300),
});

const updateDeviceSchema = z.object(deviceFields).partial();

// Pindahkan banyak perangkat ke satu area sekaligus (padanan "Move to" di Ruijie Cloud).
const bulkMoveSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, "Pilih minimal 1 perangkat").max(500),
  buildingId: optionalBuildingId,
});

const createHistorySchema = z.object({
  eventType: z.enum(["SERVIS", "PERBAIKAN", "PERUBAHAN_KONFIGURASI", "PEMASANGAN", "LAINNYA"]),
  description: z.string().min(1, "Deskripsi kejadian wajib diisi"),
});

// ---------------------------------------------------------------------------
// Port perangkat
// Skema ini hanya memvalidasi BENTUK tiap field. Aturan antar-field yang bergantung pada
// mode (Trunk / Access / Tanpa VLAN) ada di utils/portRules.js dan dijalankan di controller,
// karena pada update harus dievaluasi terhadap data gabungan (data lama + perubahan).
// Field di luar daftar (mis. status/pool dari klien lama) otomatis dibuang oleh Zod.
// ---------------------------------------------------------------------------

const portModeEnum = z.enum(["ACCESS", "TRUNK", "NO_VLAN"]);

// Prefix CIDR ringkas, mis. "/24". Boleh dikosongkan.
const prefixRegex = /^\/([0-9]|[1-2][0-9]|3[0-2])$/;

const portShape = {
  interfaceName: z.string().min(1, "Nama interface wajib diisi").max(50),
  portMode: portModeEnum,
  vlan: z.string().max(50).optional(),
  ipInterface: z
    .string()
    .regex(ipAddressRegex, "Format IP interface tidak valid")
    .optional()
    .or(z.literal("")),
  prefix: z.string().regex(prefixRegex, "Format prefix tidak valid, contoh: /24").optional().or(z.literal("")),
  description: z.string().max(255).optional(),
};

const createPortSchema = z.object(portShape);
const updatePortSchema = z.object(portShape).partial();

// Tambah banyak port sekaligus (perangkat bisa punya puluhan port).
const bulkCreatePortsSchema = z.object({
  ports: z.array(createPortSchema).min(1, "Minimal 1 port").max(200, "Maksimal 200 port per permintaan"),
});

// Generator rentang nama interface, mis. namePrefix="Gi0/" start=1 end=24 -> Gi0/1 ... Gi0/24.
// IP + prefix sengaja tidak ada di sini: alamat IP bersifat unik per port, jadi tidak bisa
// diterapkan massal. Isi IP-nya per port setelah dibuat.
const generatePortsSchema = z
  .object({
    namePrefix: z.string().min(1, "Awalan nama wajib diisi").max(40),
    start: z.coerce.number().int().min(0),
    end: z.coerce.number().int().min(0),
    portMode: portModeEnum,
    vlan: z.string().max(50).optional(),
    description: z.string().max(255).optional(),
  })
  .refine((d) => d.end >= d.start, { message: "Nomor akhir harus >= nomor awal", path: ["end"] })
  .refine((d) => d.end - d.start + 1 <= 200, { message: "Maksimal 200 port per permintaan", path: ["end"] });

module.exports = {
  PING_INTERVAL_MIN,
  PING_INTERVAL_MAX,
  ipAddressRegex,
  bulkMoveSchema,
  createDeviceSchema,
  updateDeviceSchema,
  createHistorySchema,
  createPortSchema,
  bulkCreatePortsSchema,
  generatePortsSchema,
  updatePortSchema,
};
