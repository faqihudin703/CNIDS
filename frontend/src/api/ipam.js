import { api } from "./client";

// IPAM: daftar agregat seluruh IP yang tercatat di level port (lintas perangkat).
// Read-only — mengubah data tetap melalui tab Port pada masing-masing perangkat.
export async function listIpEntries({ search, vlan, portMode, poolId } = {}) {
  const { data } = await api.get("/ipam", { params: { search, vlan, portMode, poolId } });
  return data; // { data: IpEntry[], total: number }
}

// Pool unik (satu baris per network + prefix) beserta pemakaian, perangkat, dan VLAN-nya.
export async function listPools({ search } = {}) {
  const { data } = await api.get("/ipam/pools", { params: { search } });
  return data; // { data: Pool[], total: number }
}
