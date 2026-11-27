const { z } = require("zod");

// Area/gedung opsional: perangkat boleh belum/tanpa area.
const optionalBuildingId = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable()
);

// Teks opsional: string kosong -> dianggap tidak diisi (null) agar field bisa dikosongkan lewat PATCH.
const optionalText = (max, label) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
    z.string().max(max, `${label} maksimal ${max} karakter`).nullable()
  );

module.exports = { optionalBuildingId, optionalText };
