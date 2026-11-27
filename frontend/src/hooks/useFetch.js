import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Memuat data. Dengan { keepPrevious: true } (untuk daftar yang dicari/diurutkan/dihalamani) data LAMA tetap tampil sampai
 * hasil baru tiba: `isLoading` hanya true pada pemuatan pertama, sehingga tabel tidak berkedip saat mengetik.
 * `isFetching` selalu true selama permintaan berjalan. Respons yang datang terlambat/tidak berurutan diabaikan.
 * { pollMs }: muat ulang diam-diam tiap pollMs (tanpa kedip/spinner, dijeda saat tab tidak terlihat) agar status ping
 * yang berubah langsung muncul tanpa refresh manual. Galat saat polling diabaikan; data terakhir tetap tampil.
 */
export function useFetch(fetchFn, deps = [], { keepPrevious = false, pollMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const reqId = useRef(0);

  const load = useCallback((silent = false) => {
    const id = ++reqId.current;
    if (!silent) {
      setIsFetching(true);
      if (!keepPrevious) setIsLoading(true);
      setError(null);
    }
    return fetchFn()
      .then((d) => { if (id === reqId.current) { setData(d); setIsLoading(false); } })
      .catch((err) => {
        if (id !== reqId.current || silent) return;
        setError(err.response?.data?.error || "Terjadi kesalahan saat memuat data");
        setIsLoading(false);
      })
      .finally(() => { if (id === reqId.current) setIsFetching(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) load(true);
    }, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  // Dibungkus agar argumen (mis. event klik) tidak terbaca sebagai mode diam-diam.
  const refetch = useCallback(() => load(false), [load]);

  return { data, error, isLoading, isFetching, refetch };
}
