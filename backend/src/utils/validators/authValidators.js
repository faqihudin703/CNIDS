const { z } = require("zod");

const loginSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter").max(50),
  password: z.string().min(1, "Password wajib diisi").max(100),
});

module.exports = { loginSchema };
