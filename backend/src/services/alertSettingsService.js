const prisma = require("../config/prisma");
const logger = require("../config/logger");

const FIELDS = ["offlineEnabled", "offlineAfterFailures", "offlineSeverity", "latencyEnabled", "latencyThresholdMs", "latencySeverity"];

function defaultSettings() {
  return {
    offlineEnabled: true,
    offlineAfterFailures: 1,
    offlineSeverity: "CRITICAL",
    latencyEnabled: true,
    latencyThresholdMs: Number(process.env.ALERT_LATENCY_MS) || 200,
    latencySeverity: "WARNING",
  };
}

const pick = (row) => Object.fromEntries(FIELDS.map((f) => [f, row[f]]));

// Dibaca tiap ping; di-cache sebentar supaya ratusan ping tidak menambah ratusan query. Dibatalkan saat pengaturan disimpan.
const TTL_MS = 10_000;
let cache = null;

/** Pengaturan berlaku saat ini. Bila tabel belum ada/belum diisi atau DB bermasalah, dipakai nilai bawaan (monitoring tetap jalan). */
async function getAlertSettings() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value;
  try {
    const row = await prisma.alertSetting.findUnique({ where: { id: 1 } });
    value = row ? pick(row) : defaultSettings();
  } catch (err) {
    logger.warn({ err: err.message }, "Pengaturan peringatan tidak terbaca, memakai nilai bawaan");
    value = defaultSettings();
  }
  cache = { at: Date.now(), value };
  return value;
}

async function updateAlertSettings(data, userId) {
  const row = await prisma.alertSetting.upsert({
    where: { id: 1 },
    create: { id: 1, ...data, updatedById: userId },
    update: { ...data, updatedById: userId },
  });
  cache = null;
  return pick(row);
}

const resetCache = () => { cache = null; };

module.exports = { getAlertSettings, updateAlertSettings, defaultSettings, resetCache, FIELDS };
