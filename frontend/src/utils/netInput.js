// Penyaring ketikan untuk kolom jaringan: yang tidak boleh langsung dibuang saat diketik, bukan baru ditolak saat simpan.
import { isValidIp } from "./ipPool.js";

/** IP: hanya angka dan titik (tanpa titik ganda), maksimal 15 karakter (255.255.255.255). */
export function sanitizeIp(value) {
  return String(value ?? "")
    .replace(/[^0-9.]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\./, "")
    .slice(0, 15);
}

/** Pesan galat IP untuk ditampilkan langsung di bawah kolom; null bila kosong/valid. Bagian terakhir yang masih diketik tidak dianggap salah. */
export function ipError(value) {
  const v = String(value ?? "").trim();
  if (!v || isValidIp(v)) return null;
  return "IP harus berupa angka dan titik, 4 bagian 0-255 (contoh 192.168.1.10)";
}

/** MAC: hanya angka 0-9 dan huruf A-F, otomatis KAPITAL dan diberi titik dua tiap 2 karakter (maks. 12 karakter). */
export function formatMac(value) {
  const hex = String(value ?? "").replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
  return (hex.match(/.{1,2}/g) || []).join(":");
}

export const isValidMac = (v) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(String(v ?? "").trim().toUpperCase());

export function macError(value) {
  const v = String(value ?? "").trim();
  if (!v || isValidMac(v)) return null;
  const digits = v.replace(/[^0-9A-F]/gi, "").length;
  return digits < 12 ? `MAC kurang ${12 - digits} karakter (harus 12 angka 0-9 / huruf A-F)` : "MAC hanya boleh angka 0-9 dan huruf A-F";
}

// ---- Jeda ping per perangkat -----------------------------------------------------------------------------------------
export const PING_MIN = 10;
export const PING_MAX = 86400;
const UNIT_SECONDS = { s: 1, m: 60, h: 3600 };
export const PING_UNITS = [{ value: "s", label: "detik" }, { value: "m", label: "menit" }, { value: "h", label: "jam" }];

/** Detik -> { value, unit } dengan satuan terbesar yang habis dibagi (300 -> 5 menit, 90 -> 90 detik). */
export function splitInterval(seconds) {
  const s = Number(seconds) || 300;
  if (s % 3600 === 0) return { value: String(s / 3600), unit: "h" };
  if (s % 60 === 0) return { value: String(s / 60), unit: "m" };
  return { value: String(s), unit: "s" };
}

export const toSeconds = (value, unit) => Math.round(Number(value) * (UNIT_SECONDS[unit] || 1));

export function intervalError(value, unit) {
  if (String(value).trim() === "") return "Jeda ping wajib diisi";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Jeda ping harus angka lebih dari 0";
  const sec = toSeconds(value, unit);
  if (!Number.isInteger(n * (UNIT_SECONDS[unit] || 1))) return "Jeda ping harus bilangan bulat dalam detik";
  if (sec < PING_MIN) return `Jeda ping minimal ${PING_MIN} detik`;
  if (sec > PING_MAX) return "Jeda ping maksimal 24 jam";
  return null;
}

export function formatInterval(seconds) {
  const { value, unit } = splitInterval(seconds);
  return `${value} ${PING_UNITS.find((u) => u.value === unit).label}`;
}
