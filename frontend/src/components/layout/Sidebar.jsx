import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, Server, Building2, Network, ScrollText, Users, LogOut, TriangleAlert, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../utils/format";
import { getAlertSummary } from "../../api/alerts";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/devices", label: "Perangkat", icon: Server },
  { to: "/warnings", label: "Peringatan", icon: TriangleAlert, adminOnly: true, badge: true },
  { to: "/ipam", label: "Alamat IP", icon: Network, adminOnly: true },
  { to: "/buildings", label: "Area/Gedung", icon: Building2 },
  { to: "/activity-logs", label: "Log Aktivitas", icon: ScrollText, adminOnly: true },
  { to: "/users", label: "Pengguna", icon: Users, superAdminOnly: true },
];

// Jumlah peringatan baru untuk badge menu. Diperbarui tiap 60 detik; gagal memuat -> badge disembunyikan.
function useAlertSummary(enabled) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const load = () =>
      getAlertSummary()
        .then((s) => !cancelled && setSummary(s))
        .catch(() => !cancelled && setSummary(null));
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("cnids:alerts-changed", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("cnids:alerts-changed", load);
    };
  }, [enabled]);
  return summary;
}

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const alertSummary = useAlertSummary(isAdmin);

  // Laci (HP/tablet potret) ditutup dengan tombol Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} aria-hidden="true" />}
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 max-w-[85vw] shrink-0 flex-col border-r border-base-700 bg-base-950 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent/15 text-sm font-bold text-accent">
          C
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-ink">CNIDS</p>
          <p className="mt-0.5 text-xs leading-none text-ink-faint">UPPTIK</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup menu"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded text-ink-muted hover:bg-base-800 hover:text-ink lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 scrollbar-thin">
        {NAV_ITEMS.filter(
          (item) => (!item.adminOnly || isAdmin) && (!item.superAdminOnly || isSuperAdmin)
        ).map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent-dim text-accent"
                  : "text-ink-muted hover:bg-base-800 hover:text-ink"
              }`
            }
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            <span className="flex-1">{label}</span>
            {badge && alertSummary?.active > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums ${
                  alertSummary.critical > 0 ? "bg-signal-down text-white" : "bg-signal-warn text-base-950"
                }`}
                title={`${alertSummary.active} peringatan baru`}
              >
                {alertSummary.active > 99 ? "99+" : alertSummary.active}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-base-700 px-3 py-3">
        <div className="mb-2 flex items-center gap-2.5 rounded px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-base-700 text-xs font-semibold text-ink">
            {user?.fullName?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-none text-ink">{user?.fullName}</p>
            <p className="mt-0.5 text-xs leading-none text-ink-faint">
              {ROLE_LABELS[user?.role] || ""}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-base-800 hover:text-ink"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Keluar
        </button>
      </div>
    </aside>
    </>
  );
}
