const { z } = require("zod");

const severity = z.enum(["CRITICAL", "WARNING"], { error: "Tingkat harus CRITICAL atau WARNING" });
const int = (label, min, max) =>
  z.coerce
    .number({ error: `${label} harus berupa angka` })
    .int(`${label} harus bilangan bulat`)
    .min(min, `${label} minimal ${min}`)
    .max(max, `${label} maksimal ${max}`);

const LIMITS = { failures: [1, 10], latencyMs: [10, 10000] };

// Semua field wajib: form pengaturan selalu mengirim seluruh nilainya, jadi tidak ada nilai yang tertimpa bawaan diam-diam.
const alertSettingsSchema = z.object({
  offlineEnabled: z.boolean({ error: "Status peringatan Off harus true/false" }),
  offlineAfterFailures: int("Jumlah ping gagal", ...LIMITS.failures),
  offlineSeverity: severity,
  latencyEnabled: z.boolean({ error: "Status peringatan latensi harus true/false" }),
  latencyThresholdMs: int("Ambang latensi (ms)", ...LIMITS.latencyMs),
  latencySeverity: severity,
});

module.exports = { alertSettingsSchema, ALERT_SETTING_LIMITS: LIMITS };
