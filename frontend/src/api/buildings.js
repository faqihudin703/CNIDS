import { api } from "./client";

// Mengembalikan { data: Area[] (datar, dengan parentId & statusCounts), unassigned: { ON, OFF, NEVER_ON } }
export async function listBuildings() {
  const { data } = await api.get("/buildings");
  return data;
}

export async function createBuilding(payload) {
  const { data } = await api.post("/buildings", payload);
  return data;
}

export async function updateBuilding(id, payload) {
  const { data } = await api.patch(`/buildings/${id}`, payload);
  return data;
}

export async function deleteBuilding(id) {
  await api.delete(`/buildings/${id}`);
}
