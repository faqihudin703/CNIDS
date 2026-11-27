// Pencarian & filter sisi-klien yang "dinamis": hanya memakai teks kolom yang benar-benar tampil di layar,
// dan opsi filter dibangun dari baris yang ada (lengkap dengan jumlahnya), bukan daftar tetap.
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Semua kata pencarian (dipisah spasi) harus cocok pada salah satu kolom yang tampil. */
export function matchesQuery(row, query, accessors) {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = accessors.map((get) => fold(get(row))).join("\u0001");
  return tokens.every((t) => hay.includes(t));
}

/**
 * Opsi untuk satu filter, dihitung dari baris yang lolos pencarian + filter LAIN (bukan filter ini sendiri).
 * `accessor(row)` mengembalikan satu nilai atau array nilai. Hasil: [{ value, label, count }] terurut natural.
 */
export function facetOptions(rows, accessor, labelOf = (v) => v) {
  const counts = new Map();
  for (const r of rows) {
    const v = accessor(r);
    for (const x of Array.isArray(v) ? [...new Set(v)] : [v]) {
      if (x === null || x === undefined || x === "") continue;
      counts.set(x, (counts.get(x) ?? 0) + 1);
    }
  }
  const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labelOf(value), count }))
    .sort((a, b) => collator.compare(String(a.label), String(b.label)));
}

const has = (row, accessor, value) => {
  const v = accessor(row);
  return Array.isArray(v) ? v.includes(value) : v === value;
};

/** Terapkan pencarian + semua filter; `except` melewati satu filter (untuk menghitung opsinya). */
export function applyFilters(rows, { query, searchAccessors, filters, values, except }) {
  return rows.filter((row) => {
    if (!matchesQuery(row, query, searchAccessors)) return false;
    for (const [key, accessor] of Object.entries(filters)) {
      if (key === except) continue;
      const wanted = values[key];
      if (wanted && !has(row, accessor, wanted)) return false;
    }
    return true;
  });
}
