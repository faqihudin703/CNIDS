const { isAdminOrAbove } = require("../utils/roles");
const { getCommonSummary, getAdminSummary } = require("../services/dashboardService");

/**
 * Ringkasan untuk halaman dashboard. Semua pengguna mendapat bagian umum; bagian `admin` (port, IP, status ping,
 * kelengkapan dokumentasi, aktivitas, peringatan) hanya dikirim ke Admin/Superadmin — bukan sekadar disembunyikan
 * di frontend — karena datanya mencakup detail port yang tergolong sensitif.
 */
async function getSummary(req, res) {
  const summary = await getCommonSummary();
  if (!isAdminOrAbove(req.user.role)) return res.json(summary);

  const { ports, ips, admin } = await getAdminSummary(req.user.role, summary.totals.devices);
  summary.totals.ports = ports;
  summary.totals.ips = ips;
  summary.admin = admin;
  return res.json(summary);
}

module.exports = { getSummary };
