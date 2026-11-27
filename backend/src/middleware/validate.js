/**
 * Membungkus skema Zod menjadi middleware Express.
 * Body yang sudah divalidasi & di-coerce ditimpa kembali ke req.body,
 * supaya controller menerima data yang tipenya sudah benar.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return res.status(400).json({ error: "Validasi gagal", details: issues });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
