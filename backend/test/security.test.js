// Tes keamanan otomatis (tanpa database nyata: Prisma di-stub). Jalankan: npm test
process.env.NODE_ENV = "production"; // logger JSON ke stdout, tanpa pino-pretty
process.env.DATABASE_URL = "mysql://u:p@localhost:3306/test";
process.env.CORS_ORIGIN = "https://cnids.example";
process.env.UPLOAD_DIR = require("fs").mkdtempSync(require("path").join(require("os").tmpdir(), "cnids-up-"));

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// ---- Prisma stub ------------------------------------------------------------------------------
const USERS = {
  1: { id: 1, username: "super", role: "SUPERADMIN", isActive: true, passwordChangedAt: null },
  2: { id: 2, username: "admin", role: "ADMIN", isActive: true, passwordChangedAt: null },
  3: { id: 3, username: "viewer", role: "MAHASISWA_DOSEN", isActive: true, passwordChangedAt: null },
  4: { id: 4, username: "off", role: "ADMIN", isActive: false, passwordChangedAt: null },
};
const DEVICE = {
  id: 1, name: "SW-1", type: "SWITCH", notes: "RAHASIA", macAddress: "AA:BB:CC:DD:EE:FF", firmwareVersion: "v1",
  serialNumber: "SN1", ipAddress: "10.0.0.1", createdById: 2, buildingId: null,
};
const state = { throwValidation: false };
const SESSIONS = new Map(); // id(hash) -> {id,userId,expiresAt,lastSeenAt}
const sessionStub = {
  findUnique: async ({ where }) => {
    const r = SESSIONS.get(where.id);
    return r ? { ...r, user: USERS[r.userId] ?? null } : null;
  },
  create: async ({ data }) => { SESSIONS.set(data.id, { lastSeenAt: new Date(), ...data }); return data; },
  update: async ({ where, data }) => { Object.assign(SESSIONS.get(where.id) || {}, data); return {}; },
  delete: async ({ where }) => { SESSIONS.delete(where.id); return {}; },
  deleteMany: async ({ where }) => {
    for (const [k, v] of SESSIONS) if ((where.id && k === where.id) || (where.userId && v.userId === where.userId)) SESSIONS.delete(k);
    return { count: 0 };
  },
};
const stub = new Proxy({}, {
  get: (_, model) => {
    if (model === "session") return sessionStub;
    if (model === "user") {
      return {
        findUnique: async ({ where }) => {
          if (where.id === 5) return null;
          if (where.id) return USERS[where.id] ?? null;
          if (where.username === "admin") return { ...USERS[2], passwordHash: bcrypt.hashSync("Correct-Horse-1", 4), fullName: "A" };
          if (where.username === "off") return { ...USERS[4], passwordHash: bcrypt.hashSync("Correct-Horse-1", 4), fullName: "O" };
          return null;
        },
        findMany: async () => [],
        update: async ({ data }) => ({ id: 3, ...data }),
      };
    }
    return new Proxy({}, {
      get: (_m, fn) => async () => {
        if (state.throwValidation) { const e = new Error("bad"); e.name = "PrismaClientValidationError"; throw e; }
        if (fn === "count") return 0;
        if (fn === "findUnique") return model === "device" ? { ...DEVICE, photos: [], history: [], statusChecks: [], building: null } : model === "building" ? null : { id: 1 };
        if (fn === "create") return { id: 99, name: "x" };
        if (["findMany", "groupBy"].includes(fn)) return [];
        return { id: 1 };
      },
    });
  },
});
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (/config\/prisma$/.test(request)) return stub;
  return origLoad.call(this, request, parent, ...rest);
};

const app = require("../src/app");
const { validateEnv } = require("../src/config/env");
const { createDeviceSchema } = require("../src/utils/validators/deviceValidators");
const { createUserSchema } = require("../src/utils/validators/userValidators");
const { isImage, isTextLike } = require("../src/middleware/uploadChecks");

let server, base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

// "sign" kini membuat sesi sungguhan di stub dan mengembalikan token cookie
const sign = (id, { ttlMs = 3600_000 } = {}) => {
  const token = crypto.randomBytes(32).toString("base64url");
  SESSIONS.set(crypto.createHash("sha256").update(token).digest("hex"), { id: crypto.createHash("sha256").update(token).digest("hex"), userId: id, expiresAt: new Date(Date.now() + ttlMs), lastSeenAt: new Date() });
  return token;
};
const call = (p, { token, method = "GET", body, headers = {}, csrf = true } = {}) =>
  fetch(base + p, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Cookie: `cnids_sid=${token}` } : {}),
      ...(csrf ? { "X-Requested-With": "CNIDS" } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

test("header keamanan terpasang dan x-powered-by dimatikan", async () => {
  const r = await call("/health");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.ok(r.headers.get("strict-transport-security"));
});

test("CORS: origin asing tidak mendapat izin", async () => {
  const bad = await call("/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const good = await call("/health", { headers: { Origin: "https://cnids.example" } });
  assert.equal(good.headers.get("access-control-allow-origin"), "https://cnids.example");
});

test("JSON rusak -> 400 (bukan 500)", async () => {
  const r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "CNIDS" }, body: "{bad" });
  assert.equal(r.status, 400);
});

test("body terlalu besar -> 413", async () => {
  const r = await call("/api/auth/login", { method: "POST", body: { username: "abc", password: "x".repeat(200_000) } });
  assert.equal(r.status, 413);
});

test("autentikasi: tanpa cookie, token acak, kedaluwarsa, akun nonaktif, format cookie aneh", async () => {
  assert.equal((await call("/api/devices")).status, 401);
  assert.equal((await call("/api/devices", { token: crypto.randomBytes(32).toString("base64url") })).status, 401);
  assert.equal((await call("/api/devices", { token: sign(2, { ttlMs: -1000 }) })).status, 401);
  assert.equal((await call("/api/devices", { token: sign(4) })).status, 401);
  assert.equal((await call("/api/devices", { token: sign(5) })).status, 401); // user sudah dihapus
  assert.equal((await call("/api/devices", { headers: { Cookie: "cnids_sid=' OR 1=1 --" } })).status, 401);
  assert.equal((await call("/api/devices", { headers: { Authorization: "Bearer " + sign(2) } })).status, 401); // header Bearer tidak lagi diterima
});

test("sesi kedaluwarsa dihapus dari database dan cookie dibersihkan", async () => {
  const t = sign(2, { ttlMs: -1000 });
  const before = SESSIONS.size;
  const r = await call("/api/devices", { token: t });
  assert.equal(r.status, 401);
  assert.equal(SESSIONS.size, before - 1);
  assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
});

test("reset password mencabut semua sesi akun tersebut", async () => {
  const victim = sign(3), victim2 = sign(3), admin = sign(2);
  assert.equal((await call("/api/auth/me", { token: victim })).status, 200);
  assert.equal((await call("/api/users/3/reset-password", { token: sign(1), method: "POST", body: { password: "Password-Baru-123" } })).status, 204);
  assert.equal((await call("/api/auth/me", { token: victim })).status, 401);
  assert.equal((await call("/api/auth/me", { token: victim2 })).status, 401);
  assert.equal((await call("/api/auth/me", { token: admin })).status, 200); // sesi akun lain tidak ikut
});

test("logout menghapus sesi di server (cookie curian tidak berlaku lagi)", async () => {
  const t = sign(2);
  assert.equal((await call("/api/auth/me", { token: t })).status, 200);
  const out = await call("/api/auth/logout", { token: t, method: "POST" });
  assert.equal(out.status, 204);
  assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await call("/api/auth/me", { token: t })).status, 401);
});

test("CSRF: request tulis tanpa header X-Requested-With ditolak, termasuk logout", async () => {
  const t = sign(2);
  assert.equal((await call("/api/buildings", { token: t, method: "POST", body: { name: "X" }, csrf: false })).status, 403);
  assert.equal((await call("/api/auth/logout", { token: t, method: "POST", csrf: false })).status, 403);
  assert.equal((await call("/api/auth/me", { token: t })).status, 200); // sesi masih utuh
});

test("CSRF: Origin tidak dikenal ditolak walau header ada; origin sah diterima", async () => {
  const t = sign(2);
  assert.equal((await call("/api/buildings", { token: t, method: "POST", body: { name: "X" }, headers: { Origin: "https://evil.example" } })).status, 403);
  assert.equal((await call("/api/buildings", { token: t, method: "POST", body: { name: "X" }, headers: { Origin: "https://cnids.example" } })).status, 201);
});

test("CORS: credentials hanya untuk origin sah", async () => {
  const good = await call("/health", { headers: { Origin: "https://cnids.example" } });
  assert.equal(good.headers.get("access-control-allow-credentials"), "true");
  const pre = await fetch(base + "/api/buildings", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-requested-with" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});

test("RBAC: viewer tidak bisa mengakses endpoint admin", async () => {
  const t = sign(3);
  for (const [m, p] of [["GET", "/api/ipam"], ["GET", "/api/ipam/pools"], ["GET", "/api/alerts"], ["POST", "/api/alerts/acknowledge-all"],
    ["GET", "/api/activity-logs"], ["GET", "/api/users"], ["POST", "/api/devices"], ["PATCH", "/api/devices/1"], ["DELETE", "/api/devices/1"],
    ["GET", "/api/devices/1/ports"], ["POST", "/api/devices/1/ports"], ["POST", "/api/monitoring/check-all"], ["POST", "/api/buildings"],
    ["GET", "/api/devices/configs/1/download"], ["POST", "/api/devices/bulk-move"], ["POST", "/api/devices/1/history"]]) {
    const r = await call(p, { token: t, method: m, body: m === "GET" || m === "DELETE" ? undefined : {} });
    assert.equal(r.status, 403, `${m} ${p} -> ${r.status}`);
  }
});

test("RBAC: admin tidak bisa mengelola pengguna (khusus Superadmin)", async () => {
  const t = sign(2);
  for (const [m, p] of [["GET", "/api/users"], ["POST", "/api/users"], ["PATCH", "/api/users/3"], ["POST", "/api/users/3/reset-password"], ["DELETE", "/api/users/3"]]) {
    assert.equal((await call(p, { token: t, method: m, body: m === "GET" || m === "DELETE" ? undefined : {} })).status, 403, `${m} ${p}`);
  }
  assert.equal((await call("/api/users", { token: sign(1) })).status, 200);
});

test("viewer tidak menerima field sensitif perangkat", async () => {
  const v = await (await call("/api/devices/1", { token: sign(3) })).json();
  for (const f of ["notes", "macAddress", "firmwareVersion", "ports", "configs"]) assert.ok(!(f in v) || v[f] === undefined || v[f] === false, `bocor: ${f}`);
  assert.equal(v.serialNumber, "SN1");
  const a = await (await call("/api/devices/1", { token: sign(2) })).json();
  assert.equal(a.notes, "RAHASIA");
});

test("viewer tidak bisa mencari berdasarkan MAC (kebocoran lewat pencarian)", async () => {
  const { buildBaseWhere } = require("../src/services/deviceService");
  const fieldsOf = (w) => w.OR.map((o) => Object.keys(o)[0]);
  assert.ok(!fieldsOf(await buildBaseWhere({ search: "AA:BB" }, "MAHASISWA_DOSEN")).includes("macAddress"));
  assert.ok(fieldsOf(await buildBaseWhere({ search: "AA:BB" }, "ADMIN")).includes("macAddress"));
});

test("login: pesan sama untuk username tak ada, password salah, dan akun nonaktif", async () => {
  const msgs = [];
  for (const b of [{ username: "tidakada", password: "Salah-123" }, { username: "admin", password: "Salah-123" }, { username: "off", password: "Correct-Horse-1" }]) {
    const r = await call("/api/auth/login", { method: "POST", body: b });
    assert.equal(r.status, 401);
    msgs.push((await r.json()).error);
  }
  assert.equal(new Set(msgs).size, 1);
});

test("login: cookie sesi HttpOnly+Secure+SameSite, tanpa token di body, hanya hash tersimpan", async () => {
  const r = await call("/api/auth/login", { method: "POST", body: { username: "admin", password: "Correct-Horse-1" } });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /^cnids_sid=[A-Za-z0-9_-]{43};/);
  for (const f of [/HttpOnly/, /Secure/, /SameSite=Lax/, /Path=\/api/, /Max-Age=28800/]) assert.match(cookie, f);
  const body = await r.json();
  assert.ok(!("token" in body) && !JSON.stringify(body).includes("passwordHash"));
  const raw = /cnids_sid=([^;]+)/.exec(cookie)[1];
  assert.ok(!SESSIONS.has(raw), "token mentah tersimpan di DB");
  assert.ok(SESSIONS.has(crypto.createHash("sha256").update(raw).digest("hex")), "hash sesi tidak tersimpan");
  assert.equal((await call("/api/auth/me", { token: raw })).status, 200); // cookie yang diterbitkan benar-benar berfungsi
});

test("cookie sesi tidak pernah tertulis di log", async () => {
  const token = sign(2);
  const chunks = [];
  // pino (mode produksi) menulis lewat fs.writeSync/fs.write ke fd 1, bukan process.stdout.write
  const o1 = process.stdout.write.bind(process.stdout), oS = fs.writeSync, oW = fs.write;
  const grab = (d) => chunks.push(Buffer.isBuffer(d) ? d.toString() : String(d));
  process.stdout.write = (c, ...a) => { grab(c); return o1(c, ...a); };
  fs.writeSync = (fd, d, ...a) => { if (fd === 1) grab(d); return oS(fd, d, ...a); };
  fs.write = (fd, d, ...a) => { if (fd === 1) grab(d); return oW(fd, d, ...a); };
  try {
    await call("/api/auth/me", { token });
    await new Promise((r) => setTimeout(r, 100));
  } finally {
    process.stdout.write = o1; fs.writeSync = oS; fs.write = oW;
  }
  const out = chunks.join("");
  assert.ok(out.includes("REDACTED"), "log request tidak ditemukan");
  assert.ok(!out.includes(token), "COOKIE SESI BOCOR KE LOG");
});

test("brute force: percobaan gagal berulang dibatasi (429)", async () => {
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await call("/api/auth/login", { method: "POST", body: { username: "admin", password: "Salah-" + i } })).status);
  assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401].slice(0, 5).map((c, i) => (codes[i] === 429 ? 429 : c)));
  assert.ok(codes.includes(429), `tidak ada 429: ${codes}`);
  // akun yang sama dari "IP lain" tidak terkunci permanen — dibuktikan oleh key IP+username (lihat rateLimit.js)
});

test("brute force: password-spraying lintas username dibatasi per IP", async () => {
  const codes = [];
  for (let i = 0; i < 30; i++) codes.push((await call("/api/auth/login", { method: "POST", body: { username: "user" + i, password: "Salah-123" } })).status);
  assert.ok(codes.includes(429), `tidak ada 429: ${codes}`);
});

test("parameter tidak valid dari Prisma -> 400, bukan 500", async () => {
  state.throwValidation = true;
  try {
    const r = await call("/api/devices/abc", { token: sign(2) });
    assert.equal(r.status, 400);
  } finally {
    state.throwValidation = false;
  }
});

test("mass assignment: field di luar skema dibuang validator", () => {
  const v = createDeviceSchema.parse({ name: "X", onlineStatus: "ON", createdById: 1, id: 5, lastOnlineAt: "2020-01-01" });
  for (const f of ["onlineStatus", "createdById", "id", "lastOnlineAt"]) assert.ok(!(f in v), `lolos: ${f}`);
});

test("password: maksimal 72 byte (batas bcrypt) dan minimal 8", () => {
  const base = { username: "abc", fullName: "A", role: "MAHASISWA_DOSEN" };
  assert.ok(createUserSchema.safeParse({ ...base, password: "a".repeat(72) }).success);
  assert.ok(!createUserSchema.safeParse({ ...base, password: "a".repeat(73) }).success);
  assert.ok(!createUserSchema.safeParse({ ...base, password: "é".repeat(40) }).success); // 80 byte
  assert.ok(!createUserSchema.safeParse({ ...base, password: "short" }).success);
  assert.ok(!createUserSchema.safeParse({ ...base, username: "a b; DROP", password: "a".repeat(10) }).success);
});

test("ipAddress: input berbahaya (injeksi argumen/perintah) ditolak", () => {
  for (const bad of ["-c 1000 8.8.8.8", "1.1.1.1; rm -rf /", "1.1.1.1\n", "$(id)", "999.1.1.1", "1.1.1.1 -f", "--help"]) {
    assert.ok(!createDeviceSchema.safeParse({ name: "x", ipAddress: bad }).success, `lolos: ${JSON.stringify(bad)}`);
  }
  assert.ok(createDeviceSchema.safeParse({ name: "x", ipAddress: "192.168.1.10" }).success);
});

test("validasi isi file: gambar & teks", () => {
  assert.ok(isImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])));
  assert.ok(isImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)])));
  assert.ok(isImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])));
  assert.ok(!isImage(Buffer.from("<html><script>alert(1)</script></html>")));
  assert.ok(!isImage(Buffer.from("GIF89a....")));
  assert.ok(isTextLike(Buffer.from("hostname R1\ninterface Gi0/1\n")));
  assert.ok(!isTextLike(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]))); // ELF
});

test("upload foto: HTML bernama .jpg ditolak dan file dihapus dari disk", async () => {
  const photosDir = path.join(process.env.UPLOAD_DIR, "photos");
  const before = fs.existsSync(photosDir) ? fs.readdirSync(photosDir).length : 0;
  const fd = new FormData();
  fd.append("photo", new Blob(["<html><script>alert(1)</script></html>"], { type: "image/jpeg" }), "evil.jpg");
  const r = await call("/api/devices/1/photos", { token: sign(2), method: "POST", body: fd });
  assert.equal(r.status, 400);
  assert.equal(fs.readdirSync(photosDir).length, before, "file berbahaya tertinggal di disk");
});

test("upload foto: ekstensi di luar daftar (svg/html/php) ditolak", async () => {
  for (const name of ["x.svg", "x.html", "x.php", "x.jpg.php", "x"]) {
    const fd = new FormData();
    fd.append("photo", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])]), name);
    const r = await call("/api/devices/1/photos", { token: sign(2), method: "POST", body: fd });
    assert.equal(r.status, 400, name);
  }
});

test("upload foto: JPEG asli diterima; viewer tidak boleh unggah", async () => {
  const mk = () => { const fd = new FormData(); fd.append("photo", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1])], { type: "image/jpeg" }), "a.jpg"); return fd; };
  assert.equal((await call("/api/devices/1/photos", { token: sign(2), method: "POST", body: mk() })).status, 201);
  assert.equal((await call("/api/devices/1/photos", { token: sign(3), method: "POST", body: mk() })).status, 403);
});

test("upload config: biner ditolak, teks diterima", async () => {
  const bin = new FormData(); bin.append("config", new Blob([Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0])]), "run.conf");
  assert.equal((await call("/api/devices/1/configs", { token: sign(2), method: "POST", body: bin })).status, 400);
  const txt = new FormData(); txt.append("config", new Blob(["hostname R1\n"]), "r1.cfg");
  assert.equal((await call("/api/devices/1/configs", { token: sign(2), method: "POST", body: txt })).status, 201);
});

test("static: foto disajikan dengan nosniff + CSP; config & path traversal tidak bisa diakses", async () => {
  const dir = path.join(process.env.UPLOAD_DIR, "photos");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ok.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.mkdirSync(path.join(process.env.UPLOAD_DIR, "configs"), { recursive: true });
  fs.writeFileSync(path.join(process.env.UPLOAD_DIR, "configs", "secret.cfg"), "enable secret 5 abc");

  const ok = await fetch(base + "/uploads/photos/ok.png");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
  assert.match(ok.headers.get("content-security-policy"), /default-src 'none'/);

  assert.equal((await fetch(base + "/uploads/configs/secret.cfg")).status, 404);
  for (const p of ["/uploads/photos/%2e%2e/configs/secret.cfg", "/uploads/photos/..%2fconfigs%2fsecret.cfg", "/uploads/photos/%2e%2e%2fconfigs%2fsecret.cfg"]) {
    const r = await fetch(base + p);
    assert.ok(![200].includes(r.status), `path traversal berhasil: ${p}`);
    assert.ok(!(await r.text()).includes("enable secret"), `isi config bocor: ${p}`);
  }
});

test("area/gedung: URL javascript:/data: ditolak (XSS), https diterima", async () => {
  const t = sign(2);
  for (const u of ["javascript:alert(1)", "data:text/html,<script>1</script>", "//evil.com", "ftp://x"]) {
    assert.equal((await call("/api/buildings", { token: t, method: "POST", body: { name: "A", topologyMapUrl: u } })).status, 400, u);
  }
  assert.equal((await call("/api/buildings", { token: t, method: "POST", body: { name: "A", topologyMapUrl: "https://maps.example/x" } })).status, 201);
});

test("konfigurasi: production wajib CORS_ORIGIN; SameSite=None wajib Secure", () => {
  const ok = { NODE_ENV: "production", DATABASE_URL: "x", CORS_ORIGIN: "https://a" };
  assert.equal(validateEnv(ok, { exit: false }).errors.length, 0);
  assert.ok(validateEnv({ NODE_ENV: "production", DATABASE_URL: "x" }, { exit: false }).errors.length);
  assert.ok(validateEnv({ ...ok, COOKIE_SAMESITE: "none", COOKIE_SECURE: "false" }, { exit: false }).errors.length);
  assert.ok(validateEnv({ ...ok, COOKIE_SECURE: "false" }, { exit: false }).warnings.length);
});

test("JWT dan localStorage benar-benar tidak dipakai lagi", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(path.join(__dirname, "../src")).filter((f) => f.endsWith(".js"))) {
    assert.ok(!/jsonwebtoken|jwt\.(sign|verify)/.test(fs.readFileSync(f, "utf8")), `masih ada JWT: ${f}`);
  }
  assert.ok(!("jsonwebtoken" in require("../package.json").dependencies));
});

test("tidak ada SQL mentah / eksekusi perintah shell di source", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(path.join(__dirname, "../src")).filter((f) => f.endsWith(".js"))) {
    const s = fs.readFileSync(f, "utf8");
    assert.ok(!/\$queryRaw|\$executeRaw|child_process|\beval\(|new Function\(/.test(s), `berisiko: ${f}`);
  }
});

test("SN ganda: POST /api/devices dengan SN yang sudah dipakai perangkat lain -> 409 (stub findFirst = ada pemilik)", async () => {
  const t = sign(2);
  const r = await call("/api/devices", { token: t, method: "POST", body: { name: "Dup", serialNumber: "g1qh 0001" } });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /Serial number "G1QH 0001" sudah dipakai/);
  const ok = await call("/api/devices", { token: t, method: "POST", body: { name: "TanpaSN" } });
  assert.equal(ok.status, 201, "tanpa SN tidak boleh dicek bentrok");
});
