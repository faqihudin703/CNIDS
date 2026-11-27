import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

/** Sel header <th> yang bisa diklik untuk mengurutkan. */
export function SortTh({ label, sortKey, sort, onSort, className = "", align = "left" }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      scope="col"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Urutkan berdasarkan ${label}`}
        className={`group -mx-1 inline-flex min-h-0 items-center gap-1 rounded px-1 font-medium uppercase tracking-wide transition-colors hover:text-ink ${
          active ? "text-ink" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className={`h-3 w-3 shrink-0 ${active ? "text-accent" : "text-ink-faint/60 group-hover:text-ink-muted"}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/**
 * Pengurutan versi HP (tabel menjadi kartu, header tabel disembunyikan): pilih kolom + tombol arah.
 * columns: [{ key, label }]
 */
export function SortControl({ columns, sort, onChange, className = "" }) {
  return (
    <div className={`flex items-center gap-2 md:hidden ${className}`}>
      <label className="sr-only" htmlFor="sort-key">Urutkan berdasarkan</label>
      <select
        id="sort-key"
        value={sort?.key ?? ""}
        onChange={(e) => onChange(e.target.value ? { key: e.target.value, dir: sort?.dir ?? "asc" } : null)}
        className="min-w-0 flex-1 rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink focus:border-accent"
      >
        <option value="">Urutan bawaan</option>
        {columns.map((c) => (
          <option key={c.key} value={c.key}>
            Urut: {c.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!sort}
        onClick={() => onChange({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}
        aria-label={sort?.dir === "desc" ? "Urutan turun (Z-A), ketuk untuk naik" : "Urutan naik (A-Z), ketuk untuk turun"}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-base-600 bg-base-800 text-ink-muted hover:text-ink disabled:opacity-40"
      >
        {sort?.dir === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </div>
  );
}
