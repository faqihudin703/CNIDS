import { useCallback, useMemo, useState } from "react";
import { applyFilters, facetOptions } from "../utils/filter";

/**
 * Pencarian + filter dinamis untuk tabel yang datanya sudah dimuat penuh.
 *  searchAccessors: fungsi teks kolom yang tampil; filters: { kunci: accessor }; labels: { kunci: (nilai) => label }.
 * options(kunci) selalu mengikuti baris yang sedang tampil (pencarian + filter lain), nilai terpilih tetap ada.
 */
export function useTableFilter(rows, { searchAccessors, filters = {}, labels = {} }) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState({});

  const setValue = useCallback((key, value) => setValues((v) => ({ ...v, [key]: value || "" })), []);
  const reset = useCallback(() => { setQuery(""); setValues({}); }, []);

  const filtered = useMemo(
    () => applyFilters(rows, { query, searchAccessors, filters, values }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query, values]
  );

  const options = useCallback(
    (key) => {
      const base = applyFilters(rows, { query, searchAccessors, filters, values, except: key });
      const opts = facetOptions(base, filters[key], labels[key]);
      const sel = values[key];
      if (sel && !opts.some((o) => o.value === sel)) opts.unshift({ value: sel, label: (labels[key] ?? ((v) => v))(sel), count: 0 });
      return opts;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query, values]
  );

  const active = Boolean(query.trim()) || Object.values(values).some(Boolean);
  return { query, setQuery, values, setValue, reset, filtered, options, active };
}
