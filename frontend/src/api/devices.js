import { api } from "./client";

// Mengembalikan { data, total, page, pageSize, counts: { ALL, ON, OFF, NEVER_ON } }
export async function listDevices(params = {}) {
  const { data } = await api.get("/devices", { params });
  return data;
}

export async function bulkMoveDevices(ids, buildingId) {
  const { data } = await api.post("/devices/bulk-move", { ids, buildingId });
  return data;
}

export async function getDevice(id) {
  const { data } = await api.get(`/devices/${id}`);
  return data;
}

export async function createDevice(payload) {
  const { data } = await api.post("/devices", payload);
  return data;
}

export async function updateDevice(id, payload) {
  const { data } = await api.patch(`/devices/${id}`, payload);
  return data;
}

export async function deleteDevice(id) {
  await api.delete(`/devices/${id}`);
}

export async function listHistory(deviceId) {
  const { data } = await api.get(`/devices/${deviceId}/history`);
  return data;
}

export async function addHistory(deviceId, payload) {
  const { data } = await api.post(`/devices/${deviceId}/history`, payload);
  return data;
}

export async function uploadPhoto(deviceId, file, caption) {
  const formData = new FormData();
  formData.append("photo", file);
  if (caption) formData.append("caption", caption);
  const { data } = await api.post(`/devices/${deviceId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deletePhoto(photoId) {
  await api.delete(`/devices/photos/${photoId}`);
}

export async function uploadConfig(deviceId, file) {
  const formData = new FormData();
  formData.append("config", file);
  const { data } = await api.post(`/devices/${deviceId}/configs`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export function downloadConfigUrl(configId) {
  return `/devices/configs/${configId}/download`;
}

// Endpoint config butuh sesi login (bukan static file), jadi tidak
// bisa dibuka lewat <a href> biasa — harus lewat axios lalu di-trigger manual.
export async function downloadConfigFile(configId, fileName) {
  const response = await api.get(`/devices/configs/${configId}/download`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "config";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function deleteConfig(configId) {
  await api.delete(`/devices/configs/${configId}`);
}

// Mengembalikan { check, device }: device = status On/Off terbaru hasil ping ini.
export async function triggerStatusCheck(deviceId) {
  const { data } = await api.post(`/devices/${deviceId}/status/check`);
  return data;
}

export async function getLatestStatus(deviceId) {
  const { data } = await api.get(`/devices/${deviceId}/status`);
  return data;
}

// ---- Port perangkat (admin only) ----
// Backend mendukung paginasi opsional: tanpa parameter, seluruh port dikembalikan
// (dipakai untuk pencarian/filter di client); dengan { page, pageSize }, hasil dipotong per halaman.
export async function listPorts(deviceId, { page, pageSize } = {}) {
  const { data } = await api.get(`/devices/${deviceId}/ports`, { params: { page, pageSize } });
  return data; // { data: DevicePort[], total: number }
}

export async function createPort(deviceId, payload) {
  const { data } = await api.post(`/devices/${deviceId}/ports`, payload);
  return data;
}

export async function generatePorts(deviceId, payload) {
  const { data } = await api.post(`/devices/${deviceId}/ports/generate`, payload);
  return data;
}

export async function updatePort(portId, payload) {
  const { data } = await api.patch(`/devices/ports/${portId}`, payload);
  return data;
}

export async function deletePort(portId) {
  await api.delete(`/devices/ports/${portId}`);
}
