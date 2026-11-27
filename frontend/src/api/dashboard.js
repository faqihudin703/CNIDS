import { api } from "./client";

// Ringkasan dashboard. Bagian `admin` pada response hanya dikirim backend untuk Admin/Superadmin.
export async function getDashboardSummary() {
  const { data } = await api.get("/dashboard");
  return data;
}
