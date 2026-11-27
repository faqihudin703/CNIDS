// Pengurutan tabel: teks A-Z tanpa peduli huruf besar/kecil, angka di dalam teks dibaca sebagai angka
// ("Gi0/2" sebelum "Gi0/10", "SW-9" sebelum "SW-10"), angka murni dibandingkan secara numerik.
// Nilai kosong (null/undefined/"") SELALU di paling bawah, baik urutan naik maupun turun.
const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

const isEmpty = (v) => v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));

export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

// "192.168.1.20" -> "192.168.001.020" agar urutan IP benar secara numerik per oktet (bukan per karakter).
export function ipSortKey(ip) {
  if (!ip) return null;
  const parts = String(ip).split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p)) ? parts.map((p) => p.padStart(3, "0")).join(".") : String(ip);
}

// "/24" atau "24" -> 24
export const prefixNumber = (p) => {
  const n = parseInt(String(p ?? "").replace("/", ""), 10);
  return Number.isNaN(n) ? null : n;
};

/**
 * @param rows       array data
 * @param sort       { key, dir: "asc" | "desc" } atau null (urutan bawaan, array dikembalikan apa adanya)
 * @param accessors  { [key]: (row) => nilai yang dibandingkan }
 */
export function sortRows(rows, sort, accessors) {
  const get = sort && accessors[sort.key];
  if (!get) return rows;
  const sign = sort.dir === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((x, y) => {
      const ex = isEmpty(x.value);
      const ey = isEmpty(y.value);
      if (ex || ey) return ex === ey ? x.index - y.index : ex ? 1 : -1;
      return sign * compareValues(x.value, y.value) || x.index - y.index; // stabil
    })
    .map((x) => x.row);
}
