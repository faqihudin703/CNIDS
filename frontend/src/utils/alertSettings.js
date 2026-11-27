// Ringkasan & validasi pengaturan peringatan (batas yang sama dengan backend, tapi nilai batas dibaca dari respons API).
export const SEVERITY_OPTIONS = [{ value: "CRITICAL", label: "Kritis" }, { value: "WARNING", label: "Peringatan" }];
const sevLabel = (v) => SEVERITY_OPTIONS.find((o) => o.value === v)?.label ?? v;

export function summarizeSettings(s) {
  if (!s) return [];
  return [
    s.offlineEnabled
      ? `Perangkat Off: setelah ${s.offlineAfterFailures} ping gagal berturut-turut (${sevLabel(s.offlineSeverity)})`
      : "Peringatan Off dimatikan",
    s.latencyEnabled
      ? `Latensi tinggi: mulai ${s.latencyThresholdMs} ms (${sevLabel(s.latencySeverity)})`
      : "Peringatan latensi dimatikan",
  ];
}

const intIn = (v, min, max) => {
  const n = Number(v);
  return String(v).trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
};

/** Galat per field (objek kosong = valid). Hanya field yang aktif yang divalidasi. */
export function validateSettings(form, limits) {
  const errors = {};
  const [fMin, fMax] = limits?.failures ?? [1, 10];
  const [lMin, lMax] = limits?.latencyMs ?? [10, 10000];
  if (form.offlineEnabled && !intIn(form.offlineAfterFailures, fMin, fMax)) errors.offlineAfterFailures = `Isi bilangan bulat ${fMin}-${fMax}`;
  if (form.latencyEnabled && !intIn(form.latencyThresholdMs, lMin, lMax)) errors.latencyThresholdMs = `Isi bilangan bulat ${lMin}-${lMax} ms`;
  return errors;
}
