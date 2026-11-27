import { useEffect, useState } from "react";

/** Nilai yang baru ikut berubah setelah `delay` ms tanpa perubahan (untuk pencarian ke server saat mengetik). */
export function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
