// Hierarki peran: peran yang lebih tinggi otomatis memiliki semua hak peran di bawahnya.
const ROLE_LEVEL = {
  MAHASISWA_DOSEN: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

function roleLevel(role) {
  return ROLE_LEVEL[role] ?? 0;
}

function isAdminOrAbove(role) {
  return roleLevel(role) >= ROLE_LEVEL.ADMIN;
}

module.exports = { ROLE_LEVEL, roleLevel, isAdminOrAbove };
