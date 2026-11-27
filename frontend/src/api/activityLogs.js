import { api } from "./client";

export async function listActivityLogs({ page = 1, pageSize = 50, sort, order, search } = {}) {
  const { data } = await api.get("/activity-logs", { params: { page, pageSize, sort, order, search } });
  return data;
}
