const { z } = require("zod");

// bcrypt hanya memakai 72 byte pertama. Tolak lebih panjang daripada diam-diam memotongnya.
const passwordField = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(100)
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Password maksimal 72 byte (karakter non-ASCII memakai lebih dari 1 byte)");

const roleEnum = z.enum(["MAHASISWA_DOSEN", "ADMIN", "SUPERADMIN"]);

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, dan strip"),
  password: passwordField,
  fullName: z.string().min(1, "Nama lengkap wajib diisi").max(150),
  role: roleEnum,
});

const updateUserSchema = z
  .object({
    fullName: z.string().min(1).max(150).optional(),
    role: roleEnum.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Tidak ada perubahan yang dikirim" });

const resetPasswordSchema = z.object({
  password: passwordField,
});

module.exports = { createUserSchema, updateUserSchema, resetPasswordSchema };
