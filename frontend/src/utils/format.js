export const DEVICE_TYPE_LABELS = {
  ROUTER: "Router",
  SWITCH: "Switch",
  ACCESS_POINT: "Access Point",
  SERVER: "Server",
  FIREWALL: "Firewall",
  LAINNYA: "Lainnya",
};

export const HISTORY_EVENT_LABELS = {
  SERVIS: "Servis",
  PERBAIKAN: "Perbaikan",
  PERUBAHAN_KONFIGURASI: "Perubahan Konfigurasi",
  PEMASANGAN: "Pemasangan",
  STATUS: "Perubahan Status",
  LAINNYA: "Lainnya",
};

// Jenis kejadian yang boleh dipilih admin saat menambah riwayat manual (STATUS dicatat otomatis oleh sistem).
export const MANUAL_HISTORY_EVENTS = ["SERVIS", "PERBAIKAN", "PERUBAHAN_KONFIGURASI", "PEMASANGAN", "LAINNYA"];

// Status perangkat ala Ruijie Cloud: Online / Offline / Not Online Yet.
export const ONLINE_STATUS_LABELS = { ON: "On", OFF: "Off", NEVER_ON: "Never On" };
export const ONLINE_STATUS_HINTS = {
  ON: "Ping terakhir berhasil",
  OFF: "Pernah aktif, tetapi ping terakhir gagal",
  NEVER_ON: "Belum pernah terdeteksi aktif (ping belum diaktifkan atau belum pernah berhasil)",
};
export const ONLINE_STATUS_DOT = { ON: "bg-signal-up", OFF: "bg-signal-down", NEVER_ON: "bg-base-500" };
export const ONLINE_STATUS_TEXT = { ON: "text-signal-up", OFF: "text-signal-down", NEVER_ON: "text-ink-muted" };

// ---- Peringatan (warnings) ---------------------------------------------------

export const ALERT_TYPE_LABELS = { OFFLINE: "Perangkat Off", HIGH_LATENCY: "Latensi tinggi" };
export const ALERT_SEVERITY_LABELS = { CRITICAL: "Kritis", WARNING: "Peringatan" };
export const ALERT_STATUS_LABELS = { ACTIVE: "Baru", ACKNOWLEDGED: "Diketahui", RESOLVED: "Pulih" };

// ---- Pohon Area/Gedung -----------------------------------------------------

// Daftar datar (dengan parentId) -> pohon. Tiap node mendapat `children`, `depth`, dan total
// `deviceTotal` / `statusTotals` yang sudah menjumlahkan seluruh sub-area.
export function buildAreaTree(areas) {
  const byId = new Map(areas.map((a) => [a.id, { ...a, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parentId != null ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (nodes) => nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  function finalize(node, depth) {
    node.depth = depth;
    sortNodes(node.children);
    const totals = { ...(node.statusCounts || { ON: 0, OFF: 0, NEVER_ON: 0 }) };
    for (const child of node.children) {
      finalize(child, depth + 1);
      for (const k of Object.keys(totals)) totals[k] += child.statusTotals[k];
    }
    node.statusTotals = totals;
    node.deviceTotal = totals.ON + totals.OFF + totals.NEVER_ON;
  }
  sortNodes(roots).forEach((r) => finalize(r, 0));
  return roots;
}

// Pohon -> daftar datar berurutan (untuk <select> dengan indentasi). `excludeId` membuang area itu
// beserta turunannya (dipakai saat memilih induk agar tidak membentuk siklus).
export function flattenAreaTree(nodes, excludeId = null, out = []) {
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    out.push({ id: n.id, name: n.name, depth: n.depth, label: `${"\u00A0\u00A0".repeat(n.depth)}${n.depth ? "└ " : ""}${n.name}` });
    flattenAreaTree(n.children, excludeId, out);
  }
  return out;
}

// "Kampus 2 › Gedung A › Lantai 2" untuk breadcrumb, dari daftar datar.
export function areaPath(areas, id) {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const parts = [];
  const seen = new Set();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId != null ? byId.get(cur.parentId) : null;
  }
  return parts;
}

// Durasi sejak waktu tertentu: "3 jam", "2 hari".
export function durationSince(isoString) {
  if (!isoString) return "-";
  const minutes = Math.max(Math.floor((Date.now() - new Date(isoString).getTime()) / 60000), 0);
  if (minutes < 1) return "kurang dari 1 menit";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

export function formatDate(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const PORT_MODE_LABELS = {
  ACCESS: "Access",
  TRUNK: "Trunk",
  NO_VLAN: "Tanpa VLAN",
};

export const PORT_MODE_HINTS = {
  ACCESS: "Port access: VLAN wajib. IP dan prefix boleh diisi atau dikosongkan.",
  TRUNK: "Port trunk: hanya VLAN. IP, prefix, dan pool tidak berlaku.",
  NO_VLAN: "Port biasa tanpa VLAN. IP dan prefix boleh diisi atau dikosongkan.",
};

// Field yang berlaku untuk tiap mode (harus sama dengan aturan di backend: utils/portRules.js).
export const PORT_MODE_FIELDS = {
  ACCESS: { vlan: true, ip: true },
  TRUNK: { vlan: true, ip: false },
  NO_VLAN: { vlan: false, ip: true },
};

export const PORT_MODE_BADGE = {
  ACCESS: "accent",
  TRUNK: "amber",
  NO_VLAN: "neutral",
};

export const ROLE_LABELS = {
  MAHASISWA_DOSEN: "User",
  ADMIN: "Admin Jaringan",
  SUPERADMIN: "Superadmin",
};

export const ROLE_DESCRIPTIONS = {
  MAHASISWA_DOSEN: "Hanya melihat informasi non-sensitif",
  ADMIN: "Mengelola dokumentasi jaringan (perangkat, port, foto, konfigurasi)",
  SUPERADMIN: "Semua hak admin, ditambah mengelola akun pengguna",
};

// "5 menit lalu", "2 jam lalu", "3 hari lalu"; lebih dari seminggu menampilkan tanggal.
export function timeAgo(isoString) {
  if (!isoString) return "-";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDateShort(isoString);
}
