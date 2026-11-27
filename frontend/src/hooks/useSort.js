import { useState, useCallback } from "react";

/**
 * Status pengurutan satu tabel. Klik kolom yang sama berulang: naik (A-Z / 1-9) -> turun (Z-A / 9-1) -> urutan bawaan.
 */
export function useSort(initial = null) {
  const [sort, setSort] = useState(initial);
  const toggle = useCallback(
    (key) =>
      setSort((s) => {
        if (!s || s.key !== key) return { key, dir: "asc" };
        return s.dir === "asc" ? { key, dir: "desc" } : null;
      }),
    []
  );
  return { sort, toggle, setSort };
}
