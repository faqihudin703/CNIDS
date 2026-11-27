// Aturan field port berdasarkan mode (hasil bimbingan):
//   TRUNK   : hanya VLAN. IP interface dan prefix tidak boleh ada (pool otomatis ikut hilang).
//   ACCESS  : VLAN wajib. IP + prefix opsional, tetapi harus diisi berpasangan.
//   NO_VLAN : port biasa tanpa VLAN. IP + prefix opsional, berpasangan.

const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";

/** @returns {{field: string, message: string}[]} daftar pelanggaran (kosong = valid) */
function checkPortRules({ portMode, vlan, ipInterface, prefix }) {
  const errors = [];

  if (portMode === "TRUNK") {
    if (!has(vlan)) errors.push({ field: "vlan", message: "Port Trunk wajib memiliki VLAN" });
    if (has(ipInterface)) errors.push({ field: "ipInterface", message: "Port Trunk tidak boleh memiliki IP interface" });
    if (has(prefix)) errors.push({ field: "prefix", message: "Port Trunk tidak boleh memiliki prefix" });
    return errors;
  }

  if (portMode === "ACCESS" && !has(vlan)) {
    errors.push({ field: "vlan", message: "Port Access wajib memiliki VLAN" });
  }
  if (portMode === "NO_VLAN" && has(vlan)) {
    errors.push({ field: "vlan", message: "Port tanpa VLAN tidak boleh memiliki VLAN" });
  }
  if (has(ipInterface) && !has(prefix)) {
    errors.push({ field: "prefix", message: "Prefix wajib diisi bila IP interface diisi" });
  }
  if (has(prefix) && !has(ipInterface)) {
    errors.push({ field: "ipInterface", message: "IP interface wajib diisi bila prefix diisi" });
  }
  return errors;
}

// String kosong disimpan sebagai null, dan field yang tidak berlaku pada suatu mode dikosongkan.
function normalizePort(data) {
  const clean = (v) => (has(v) ? String(v).trim() : null);
  const mode = data.portMode;
  return {
    interfaceName: data.interfaceName,
    portMode: mode,
    description: clean(data.description),
    vlan: mode === "NO_VLAN" ? null : clean(data.vlan),
    ipInterface: mode === "TRUNK" ? null : clean(data.ipInterface),
    prefix: mode === "TRUNK" ? null : clean(data.prefix),
  };
}

module.exports = { checkPortRules, normalizePort, has };
