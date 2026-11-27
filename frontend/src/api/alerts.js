import { api } from "./client";

// view: "active" (aktif + diketahui) | "resolved" | "all"
// Mengembalikan { data, total, page, pageSize, counts: { active, critical, acknowledged, resolved } }
export async function listAlerts(params = {}) {
  const { data } = await api.get("/alerts", { params });
  return data;
}

export async function getAlertSummary() {
  const { data } = await api.get("/alerts/summary");
  return data; // { active, critical }
}

export async function acknowledgeAlert(id) {
  const { data } = await api.post(`/alerts/${id}/acknowledge`);
  return data;
}

export async function acknowledgeAllAlerts() {
  const { data } = await api.post("/alerts/acknowledge-all");
  return data;
}

// { settings: { offlineEnabled, offlineAfterFailures, offlineSeverity, latencyEnabled, latencyThresholdMs, latencySeverity }, limits }
export async function getAlertSettings() {
  const { data } = await api.get("/alerts/settings");
  return data;
}

// Hanya Superadmin.
export async function updateAlertSettings(settings) {
  const { data } = await api.put("/alerts/settings", settings);
  return data;
}
