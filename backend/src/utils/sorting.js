// Pengurutan sisi-server untuk daftar yang dipaginasi. Kunci urut WAJIB lewat whitelist (tidak pernah dipakai mentah
// sebagai nama kolom), jadi `?sort=` tidak bisa dipakai untuk mengurutkan berdasarkan kolom sensitif atau memicu error.

const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

/** @returns {{key: string, dir: "asc"|"desc"} | null} null bila tidak diminta / tidak ada di whitelist. */
function parseSort(query, allowedKeys) {
  const key = typeof query.sort === "string" ? query.sort : "";
  if (!key || !allowedKeys.includes(key)) return null;
  return { key, dir: query.order === "desc" ? "desc" : "asc" };
}

/** Bandingkan dua nilai secara "natural" (Gi0/2 < Gi0/10), IP per oktet, kosong selalu di akhir. Mengembalikan fungsi comparator. */
function ipKey(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip ?? "").trim());
  return m ? m.slice(1).map((o) => o.padStart(3, "0")).join(".") : String(ip ?? "");
}

function makeComparator(dir, { ip = false } = {}) {
  const sign = dir === "desc" ? -1 : 1;
  return (a, b) => {
    const ea = a.value === null || a.value === undefined || a.value === "";
    const eb = b.value === null || b.value === undefined || b.value === "";
    if (ea || eb) return ea && eb ? a.id - b.id : ea ? 1 : -1; // kosong selalu terakhir, apa pun arahnya
    const va = ip ? ipKey(a.value) : String(a.value);
    const vb = ip ? ipKey(b.value) : String(b.value);
    return collator.compare(va, vb) * sign || a.id - b.id;
  };
}

/** Urutkan [{id, value}] lalu kembalikan id untuk satu halaman. */
function sortedPageIds(items, dir, { skip, take, ip = false }) {
  return [...items].sort(makeComparator(dir, { ip })).slice(skip, skip + take).map((i) => i.id);
}

module.exports = { parseSort, makeComparator, sortedPageIds, ipKey };
