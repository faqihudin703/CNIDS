const { z } = require("zod");
const { optionalBuildingId, optionalText } = require("./common");

// Hanya http(s): "javascript:", "data:", dan skema lain ditolak (mencegah XSS bila URL dirender sebagai tautan).
const httpUrl = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
  z
    .string()
    .max(500, "URL maksimal 500 karakter")
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "topologyMapUrl harus berupa URL http/https yang valid")
    .nullable()
);

const createBuildingSchema = z.object({
  name: z.string().trim().min(1, "Nama area/gedung wajib diisi").max(150, "Nama area/gedung maksimal 150 karakter"),
  code: optionalText(30, "Kode").optional(),
  description: optionalText(255, "Deskripsi").optional(),
  topologyMapUrl: httpUrl.optional(),
  parentId: optionalBuildingId.optional(), // area induk (null/kosong = tingkat teratas)
});

const updateBuildingSchema = createBuildingSchema.partial();

module.exports = { createBuildingSchema, updateBuildingSchema };
