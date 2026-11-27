import { api } from "./client";

// Kelola akun pengguna — hanya Superadmin (backend menolak peran lain dengan 403).
export async function listUsers({ search, role } = {}) {
  const { data } = await api.get("/users", { params: { search, role } });
  return data; // { data: User[], total: number }
}

export async function createUser(payload) {
  const { data } = await api.post("/users", payload);
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data;
}

export async function resetUserPassword(id, password) {
  await api.post(`/users/${id}/reset-password`, { password });
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}
