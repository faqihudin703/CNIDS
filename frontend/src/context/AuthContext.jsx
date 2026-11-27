import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { login as loginApi, logout as logoutApi, getMe } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Tidak ada token/data user di localStorage: status login diambil dari server lewat cookie sesi.
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // bersihkan sisa token dari versi lama (JWT di localStorage)
      localStorage.removeItem("cnids_token");
      localStorage.removeItem("cnids_user");
    } catch {
      /* storage tidak tersedia: abaikan */
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("cnids:unauthorized", onUnauthorized);
    return () => window.removeEventListener("cnids:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const { user: loggedInUser } = await loginApi(username, password);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* sesi mungkin sudah habis: tetap keluarkan dari UI */
    }
    setUser(null);
  }, []);

  // isAdmin berarti "admin ke atas" (ADMIN atau SUPERADMIN), sehingga seluruh halaman
  // dokumentasi yang sudah ada otomatis ikut berlaku untuk Superadmin.
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const isAdmin = user?.role === "ADMIN" || isSuperAdmin;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isSuperAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
