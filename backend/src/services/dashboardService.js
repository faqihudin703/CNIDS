const prisma = require("../config/prisma");
const { activityWhereFor } = require("../utils/activityVisibility");
const { ONLINE_STATUSES } = require("../utils/constants");
const { getAlertCounts } = require("./alertService");

// Bagian umum: dikirim ke semua pengguna.
async function getCommonSummary() {
  const [areas, unassignedDevices, byType, byStatus, recentDevices] = await Promise.all([
    prisma.building.findMany({ select: { id: true, name: true, _count: { select: { devices: true } } } }),
    prisma.device.count({ where: { buildingId: null } }),
    prisma.device.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.device.groupBy({ by: ["onlineStatus"], _count: { _all: true } }),
    prisma.device.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true, name: true, type: true, ipAddress: true, model: true, serialNumber: true,
        onlineStatus: true, updatedAt: true, building: { select: { name: true } },
      },
    }),
  ]);

  // total perangkat = jumlah semua status (tanpa query count tambahan)
  const totalDevices = byStatus.reduce((sum, r) => sum + r._count._all, 0);

  return {
    totals: { devices: totalDevices, areas: areas.length, unassignedDevices },
    devicesByStatus: ONLINE_STATUSES.map((status) => ({
      status,
      count: byStatus.find((r) => r.onlineStatus === status)?._count._all ?? 0,
    })),
    devicesByType: byType.map((r) => ({ type: r.type, count: r._count._all })).sort((a, b) => b.count - a.count),
    areas: areas
      .map((a) => ({ id: a.id, name: a.name, count: a._count.devices }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6),
    recentDevices,
  };
}

/**
 * Ringkasan status ping dari kolom Device (onlineStatus/lastCheckedAt), bukan dengan memuat riwayat status_checks
 * tiap perangkat. Perangkat belum pernah dicek / tanpa IP dihitung "belum diketahui".
 */
async function getMonitoringSummary() {
  const base = { monitorMethod: "ICMP" };
  const checked = { ...base, ipAddress: { not: null }, lastCheckedAt: { not: null } };
  const [total, checkedByStatus, downDevices] = await Promise.all([
    prisma.device.count({ where: base }),
    prisma.device.groupBy({ by: ["onlineStatus"], where: checked, _count: { _all: true } }),
    prisma.device.findMany({
      where: { ...checked, onlineStatus: { in: ["OFF", "NEVER_ON"] } },
      select: { id: true, name: true, ipAddress: true },
      orderBy: { name: "asc" },
      take: 5,
    }),
  ]);
  const n = (s) => checkedByStatus.find((r) => r.onlineStatus === s)?._count._all ?? 0;
  const up = n("ON");
  const down = n("OFF") + n("NEVER_ON");
  return { total, up, down, unknown: total - up - down, downDevices };
}

// Bagian admin: detail port, IP, status ping, kelengkapan dokumentasi, aktivitas, peringatan.
async function getAdminSummary(role, totalDevices) {
  const hasText = (field) => ({ AND: [{ [field]: { not: null } }, { [field]: { not: "" } }] });

  const [totalPorts, totalIps, byMode, monitoring, withPhoto, withConfig, withPorts, withLocation, recentActivity, alertCounts] =
    await Promise.all([
      prisma.devicePort.count(),
      prisma.devicePort.count({ where: { ipInterface: { not: null } } }),
      prisma.devicePort.groupBy({ by: ["portMode"], _count: { _all: true } }),
      getMonitoringSummary(),
      prisma.device.count({ where: { photos: { some: {} } } }),
      prisma.device.count({ where: { configs: { some: {} } } }),
      prisma.device.count({ where: { ports: { some: {} } } }),
      prisma.device.count({ where: hasText("location") }),
      prisma.activityLog.findMany({
        where: activityWhereFor(role),
        orderBy: { loggedAt: "desc" },
        take: 8,
        include: { user: { select: { fullName: true } } },
      }),
      getAlertCounts(),
    ]);

  return {
    ports: totalPorts,
    ips: totalIps,
    admin: {
      portsByMode: byMode.map((r) => ({ mode: r.portMode, count: r._count._all })),
      monitoring,
      alerts: { open: alertCounts.open, critical: alertCounts.critical },
      coverage: { devices: totalDevices, withPhoto, withConfig, withPorts, withLocation },
      recentActivity: recentActivity.map((l) => ({
        id: l.id, action: l.action, loggedAt: l.loggedAt, userName: l.user?.fullName ?? null,
      })),
    },
  };
}

module.exports = { getCommonSummary, getAdminSummary, getMonitoringSummary };
