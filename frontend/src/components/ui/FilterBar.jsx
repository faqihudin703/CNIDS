import { Search, X } from "lucide-react";

const field = "rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink focus:border-accent";

/** Kotak pencarian standar (ikon kaca pembesar + tombol hapus). */
export function SearchBox({ value, onChange, placeholder, className = "" }) {
  return (
    <div className={`relative w-full sm:max-w-xs ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded border border-base-600 bg-base-800 py-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Dropdown filter dinamis: opsi = [{ value, label, count }] dari data yang tampil; "Semua …" selalu ada. */
export function FilterSelect({ label, value, onChange, options, formatOption }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={field}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {formatOption ? formatOption(o) : o.label} ({o.count})
        </option>
      ))}
    </select>
  );
}

/** Ringkasan hasil + tombol reset, mis. "3 dari 12". */
export function FilterSummary({ shown, total, active, onReset, unit = "data" }) {
  return (
    <p className="flex items-center gap-2 text-xs text-ink-faint" aria-live="polite">
      <span>
        {active ? `${shown} dari ${total} ${unit}` : `${total} ${unit}`}
      </span>
      {active && (
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded text-accent hover:underline">
          <X className="h-3 w-3" /> Reset filter
        </button>
      )}
    </p>
  );
}
