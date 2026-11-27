const { getAlertSettings, updateAlertSettings, FIELDS } = require("../services/alertSettingsService");
const { logActivity } = require("../utils/activityLogger");
const { ALERT_SETTING_LIMITS } = require("../utils/validators/alertSettingsValidators");

const LABELS = {
  offlineEnabled: "peringatan Off",
  offlineAfterFailures: "ping gagal sebelum Off",
  offlineSeverity: "tingkat Off",
  latencyEnabled: "peringatan latensi",
  latencyThresholdMs: "ambang latensi (ms)",
  latencySeverity: "tingkat latensi",
};

// Admin boleh melihat (agar tahu ambang yang berlaku); hanya Superadmin yang mengubah.
async function getSettings(req, res) {
  return res.json({ settings: await getAlertSettings(), limits: ALERT_SETTING_LIMITS });
}

async function updateSettings(req, res) {
  const before = await getAlertSettings();
  const settings = await updateAlertSettings(req.body, req.user.id);
  const changes = FIELDS.filter((f) => before[f] !== settings[f]).map((f) => `${LABELS[f]}: ${before[f]} -> ${settings[f]}`);
  if (changes.length) await logActivity(req.user.id, `Mengubah pengaturan peringatan (${changes.join("; ")})`);
  return res.json({ settings, limits: ALERT_SETTING_LIMITS });
}

module.exports = { getSettings, updateSettings };
