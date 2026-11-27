import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  // sesi login = cookie httpOnly dari server; JavaScript tidak pernah memegang token
  withCredentials: true,
  // tanpa timeout, request yang macet membuat halaman loading selamanya
  timeout: 15000,
  // header penanda untuk proteksi CSRF di backend (wajib pada request yang mengubah data)
  headers: { "X-Requested-With": "CNIDS" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    // 401 di luar proses login/cek sesi = sesi habis/dicabut: beri tahu AuthContext agar kembali ke halaman login
    if (error.response?.status === 401 && !url.startsWith("/auth/")) {
      window.dispatchEvent(new Event("cnids:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export function getFileUrl(path) {
  if (!path) return null;
  return `${API_BASE_URL}${path}`;
}
