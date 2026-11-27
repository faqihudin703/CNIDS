/**
 * Menjalankan fn untuk semua item dengan paling banyak `limit` yang berjalan bersamaan.
 * Hasil berbentuk seperti Promise.allSettled (urutan sama dengan input); satu kegagalan tidak menghentikan yang lain.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker));
  return results;
}

module.exports = { mapWithConcurrency };
