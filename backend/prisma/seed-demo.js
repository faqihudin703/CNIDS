// Data contoh untuk demo/uji tampilan: perangkat dengan SN/model/status, port, dan IP pool bersama.
// Jalankan SETELAH `npm run seed`:  npm run seed:demo   (aman diulang; SN yang sama dilewati)
const { PrismaClient } = require("@prisma/client");
const { resolvePoolId } = require("../src/services/poolService");

const prisma = new PrismaClient();
const ago = (h) => new Date(Date.now() - h * 3600 * 1000);

const DEVICES = [
  { name: "SW-Core-01", sn: "G1QH00000001", type: "SWITCH", vendor: "Ruijie", model: "RG-S5310-24GT4XS-E", ip: "10.10.0.2", mac: "00:D0:F8:10:00:01", fw: "RGOS 12.5", area: "UPPTIK-SRV", loc: "Rak 1, Ruang Server", status: "ON",
    ports: [["Gi0/1", "ACCESS", "10", "10.10.10.1", "/24", "Gateway VLAN 10"], ["Gi0/2", "ACCESS", "20", "10.10.20.1", "/24", "Gateway VLAN 20"], ["Gi0/24", "TRUNK", "10,20,30", null, null, "Uplink ke router"], ["Gi0/10", "NO_VLAN", null, "10.10.99.5", "/24", "Link manajemen"]] },
  { name: "RT-Edge-01", sn: "G1QH00000002", type: "ROUTER", vendor: "MikroTik", model: "CCR1036-8G-2S+", ip: "10.10.0.1", mac: "4C:5E:0C:10:00:02", fw: "RouterOS 7.14", area: "UPPTIK-SRV", loc: "Rak 1, Ruang Server", status: "ON",
    ports: [["ether1", "NO_VLAN", null, "10.10.99.1", "/24", "Link ke ISP"], ["ether2", "ACCESS", "10", "10.10.10.254", "/24", "LAN VLAN 10"]] },
  { name: "AP-Lt2-01", sn: "G1QH00000003", type: "ACCESS_POINT", vendor: "Ruijie", model: "RG-RAP2260(E)", ip: "10.10.20.11", mac: "00:D0:F8:10:00:03", fw: "ReyeeOS 2.320", area: "UPPTIK-L2", loc: "Lorong Lantai 2", status: "OFF" },
  { name: "AP-Lt2-02", sn: "G1QH00000004", type: "ACCESS_POINT", vendor: "Ruijie", model: "RG-RAP2260(E)", ip: "10.10.20.12", mac: "00:D0:F8:10:00:04", fw: "ReyeeOS 2.320", area: "UPPTIK-L2", loc: "Ruang Rapat", status: "NEVER_ON" },
  { name: "SRV-Web-01", sn: "G1QH00000005", type: "SERVER", vendor: "Dell", model: "PowerEdge R450", ip: "10.10.30.10", mac: "B0:7B:25:10:00:05", fw: "iDRAC 6.10", area: "UPPTIK-SRV", loc: "Rak 2, Ruang Server", status: "ON" },
  { name: "FW-Main", sn: null, type: "FIREWALL", vendor: "Fortinet", model: "FortiGate 100F", ip: "10.10.0.254", mac: "00:09:0F:10:00:06", fw: "FortiOS 7.2", area: "UPPTIK", loc: "Ruang Server", status: "NEVER_ON" },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!admin) throw new Error('Akun "admin" belum ada. Jalankan: npm run seed');

  const areas = Object.fromEntries((await prisma.building.findMany()).map((b) => [b.code, b.id]));
  const cache = new Map();
  let created = 0;

  for (const d of DEVICES) {
    if (d.sn && (await prisma.device.findUnique({ where: { serialNumber: d.sn } }))) continue;

    const device = await prisma.device.create({
      data: {
        name: d.name, type: d.type, serialNumber: d.sn, vendor: d.vendor, model: d.model,
        ipAddress: d.ip, macAddress: d.mac, firmwareVersion: d.fw, buildingId: areas[d.area] ?? null,
        location: d.loc, description: `Contoh data: ${d.model}`, monitorMethod: "ICMP",
        onlineStatus: d.status,
        lastOnlineAt: d.status === "NEVER_ON" ? null : ago(d.status === "OFF" ? 6 : 0.1),
        offlineSince: d.status === "OFF" ? ago(5) : null,
        lastCheckedAt: d.status === "NEVER_ON" && !d.sn ? null : ago(0.1),
        createdById: admin.id,
      },
    });

    for (const [interfaceName, portMode, vlan, ipInterface, prefix, description] of d.ports || []) {
      const poolId = await resolvePoolId(prisma, ipInterface, prefix, cache);
      await prisma.devicePort.create({
        data: { deviceId: device.id, interfaceName, portMode, vlan, ipInterface, prefix, description, poolId },
      });
    }
    if (d.status === "OFF") {
      await prisma.deviceAlert.create({
        data: { deviceId: device.id, type: "OFFLINE", severity: "CRITICAL", message: "Perangkat tidak merespons ping (Off)", triggeredAt: ago(5) },
      });
      await prisma.deviceHistory.create({ data: { deviceId: device.id, eventType: "STATUS", description: "Perangkat Off (ping gagal)", recordedAt: ago(5) } });
    }
    created++;
  }
  console.log(`Data contoh: ${created} perangkat dibuat (${DEVICES.length - created} dilewati karena SN sudah ada).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
