// Log aktivitas milik Superadmin hanya boleh dilihat oleh Superadmin.
// Admin melihat semua log kecuali yang dilakukan oleh akun Superadmin.
//
// Kondisi `userId: null` ditulis eksplisit karena log sistem (tanpa user) harus tetap terlihat;
// jika hanya memakai NOT(role = SUPERADMIN), baris dengan user_id NULL ikut tersaring oleh SQL.
function activityWhereFor(role) {
  if (role === "SUPERADMIN") return {};
  return {
    OR: [{ userId: null }, { user: { is: { role: { not: "SUPERADMIN" } } } }],
  };
}

module.exports = { activityWhereFor };
