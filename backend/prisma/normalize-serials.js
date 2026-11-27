// Merapikan serial number lama (trim, spasi ganda -> satu, HURUF BESAR; kosong -> NULL) agar aturan "satu SN = satu
// perangkat" berlaku juga untuk data lama. SN yang akan bentrok setelah dirapikan TIDAK diubah, hanya dilaporkan.
// Aman dijalankan berulang.  Jalankan: npm run normalize:serials
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const normalize = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().replace(/\s+/g, " ").toUpperCase() : null);

async function main() {
  const devices = await prisma.device.findMany({ select: { id: true, name: true, serialNumber: true }, orderBy: { id: "asc" } });
  const owner = new Map(); // SN ternormalisasi -> device pertama
  const conflicts = [];
  let changed = 0;
  for (const d of devices) {
    const sn = normalize(d.serialNumber);
    if (sn && owner.has(sn)) { conflicts.push({ id: d.id, name: d.name, sn, with: owner.get(sn) }); continue; }
    if (sn) owner.set(sn, `${d.name} (ID ${d.id})`);
    if (sn !== d.serialNumber) {
      await prisma.device.update({ where: { id: d.id }, data: { serialNumber: sn } });
      changed++;
    }
  }
  console.log(`Selesai: ${devices.length} perangkat diperiksa, ${changed} SN dirapikan.`);
  for (const c of conflicts) console.log(`BENTROK: "${c.name}" (ID ${c.id}) memakai SN ${c.sn} yang sama dengan ${c.with} -> perbaiki manual.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
