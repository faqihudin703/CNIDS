const ipamService = require("../services/ipamService");

/**
 * IPAM — daftar agregat seluruh IP yang tercatat di level port (DevicePort.ipInterface). Pool dihitung otomatis
 * dari IP + prefix. Port Trunk tidak pernah punya IP sehingga tidak muncul. View read-only; perubahan lewat tab
 * Port perangkat.
 */
async function listIpEntries(req, res) {
  return res.json(await ipamService.listIpEntries(req.query));
}

// Daftar pool unik beserta pemakaiannya (used = jumlah IP berbeda; utilization = used / kapasitas host).
async function listPools(req, res) {
  return res.json(await ipamService.listPools(req.query));
}

module.exports = { listIpEntries, listPools };
