const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Tiga akun awal, satu per peran. Password bisa diatur lewat env; nilai bawaan
// HANYA untuk setup awal dan harus segera diganti (Superadmin: menu Pengguna -> Atur ulang password).
const ACCOUNTS = [
  { username: "superadmin", fullName: "Superadmin UPPTIK", role: "SUPERADMIN", env: "SEED_SUPERADMIN_PASSWORD", fallback: "ChangeMe123!" },
  { username: "admin", fullName: "Administrator UPPTIK", role: "ADMIN", env: "SEED_ADMIN_PASSWORD", fallback: "ChangeMe123!" },
  { username: "user", fullName: "Pengguna Contoh", role: "MAHASISWA_DOSEN", env: "SEED_USER_PASSWORD", fallback: "ChangeMe123!" },
];

async function main() {
  for (const acc of ACCOUNTS) {
    const password = process.env[acc.env] || acc.fallback;
    // Password bawaan hanya untuk development; di production wajib diatur lewat env.
    if (process.env.NODE_ENV === "production" && (!process.env[acc.env] || password === acc.fallback || password.length < 12)) {
      throw new Error(`Set ${acc.env} (minimal 12 karakter, bukan nilai bawaan) sebelum seed di production`);
    }
    const passwordHash = await bcrypt.hash(password, 12);

    // update: {} -> akun yang sudah ada tidak ditimpa (password/peran tidak di-reset saat seed diulang)
    await prisma.user.upsert({
      where: { username: acc.username },
      update: {},
      create: { username: acc.username, passwordHash, fullName: acc.fullName, role: acc.role },
    });
    console.log(`Akun siap: ${acc.username} (${acc.role}) | password awal: ${password}`);
  }
  console.log("SEGERA ganti seluruh password bawaan di atas sebelum dipakai di lingkungan nyata.");

  const building = await prisma.building.upsert({
    where: { code: "UPPTIK" },
    update: {},
    create: { name: "Gedung UPPTIK", code: "UPPTIK" },
  });
  console.log(`Data contoh siap: area "${building.name}" (ID ${building.id})`);

  // Contoh sub-area agar tampilan pohon Area/Gedung langsung terlihat.
  for (const sub of [
    { name: "Ruang Server", code: "UPPTIK-SRV" },
    { name: "Lantai 2", code: "UPPTIK-L2" },
  ]) {
    await prisma.building.upsert({
      where: { code: sub.code },
      update: {},
      create: { ...sub, parentId: building.id },
    });
  }
}

main()
  .catch((e) => {
    console.error("Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
