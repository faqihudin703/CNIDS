import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Check, ShieldCheck, Settings } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import StatusDot from "../components/ui/StatusDot";
import { LoadingState, ErrorState } from "../components/ui/States";
import { Pagination } from "../components/devices/DeviceList";
import { useFetch } from "../hooks/useFetch";
import { useSort } from "../hooks/useSort";
import { useDebounced } from "../hooks/useDebounced";
import { SearchBox } from "../components/ui/FilterBar";
import { SortTh, SortControl } from "../components/ui/SortControls";
import AlertSettingsModal from "../components/alerts/AlertSettingsModal";
import { useAuth } from "../context/AuthContext";
import { summarizeSettings } from "../utils/alertSettings";
import { listAlerts, acknowledgeAlert, acknowledgeAllAlerts, getAlertSettings } from "../api/alerts";
import {
  ALERT_TYPE_LABELS,
  ALERT_SEVERITY_LABELS,
  ALERT_STATUS_LABELS,
  durationSince,
  formatDate,
} from "../utils/format";

const PAGE_SIZE = 25;
const VIEWS = [
  { key: "active", label: "Aktif" },
  { key: "resolved", label: "Sudah pulih" },
  { key: "all", label: "Semua" },
];
const SEVERITY_BADGE = { CRITICAL: "down", WARNING: "amber" };
const STATUS_BADGE = { ACTIVE: "down", ACKNOWLEDGED: "neutral", RESOLVED: "up" };

function notifyChanged() {
  window.dispatchEvent(new Event("cnids:alerts-changed")); // memperbarui badge sidebar
}

// Peringatan perangkat (padanan Warnings di Ruijie Cloud). Dibuat otomatis dari hasil ping:
// perangkat Off dan latensi tinggi. Tertutup sendiri begitu kondisi pulih.
const ALERT_SORT_COLUMNS = [
  { key: "severity", label: "Tingkat" },
  { key: "device", label: "Perangkat" },
  { key: "message", label: "Peringatan" },
  { key: "triggeredAt", label: "Mulai" },
  { key: "status", label: "Status" },
];

export default function WarningsPage() {
  const { isSuperAdmin } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const { data: settingsData, refetch: refetchSettings } = useFetch(getAlertSettings, []);
  const [view, setView] = useState("active");
  const [severity, setSeverity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 250);
  const [page, setPage] = useState(1);
  const { sort, toggle: toggleSort, setSort } = useSort(); // diurutkan di server
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => setPage(1), [view, severity, sort, search]);

  const fetchAlerts = useMemo(
    () => () => listAlerts({ view, severity: severity || undefined, search: search || undefined, sort: sort?.key, order: sort?.dir, page, pageSize: PAGE_SIZE }),
    [view, severity, search, page, sort]
  );
  const { data, error, isLoading, refetch } = useFetch(fetchAlerts, [view, severity, search, page, sort], { keepPrevious: true, pollMs: 10000 }); // peringatan baru muncul tanpa refresh manual

  const counts = data?.counts;

  async function handleAck(id) {
    setBusyId(id);
    setActionError(null);
    try {
      await acknowledgeAlert(id);
      notifyChanged();
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.error || "Gagal menandai peringatan");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAckAll() {
    if (!window.confirm(`Tandai ${counts.active} peringatan baru sebagai diketahui?`)) return;
    setBusyId("all");
    setActionError(null);
    try {
      await acknowledgeAllAlerts();
      notifyChanged();
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.error || "Gagal menandai peringatan");
    } finally {
      setBusyId(null);
    }
  }

  const th = "whitespace-nowrap px-3 py-2.5 font-medium";

  return (
    <AppShell
      title="Peringatan"
      description="Perangkat yang Off atau lambat merespons, terdeteksi otomatis dari ping"
      action={
        <div className="flex items-center gap-2">
          {isSuperAdmin && settingsData && (
            <Button size="sm" variant="secondary" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Pengaturan peringatan</span>
              <span className="sm:hidden">Pengaturan</span>
            </Button>
          )}
          {counts?.active > 0 && (
            <Button size="sm" variant="secondary" onClick={handleAckAll} disabled={busyId === "all"}>
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Tandai semua diketahui</span>
              <span className="sm:hidden">Tandai semua</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {settingsData && (
          <p className="rounded border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-muted" data-testid="alert-rules">
            <span className="font-medium text-ink">Aturan peringatan:</span> {summarizeSettings(settingsData.settings).join(" · ")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Baru" value={counts?.active} tone="text-signal-down" hint="belum ditandai" />
          <Tile label="Kritis" value={counts?.critical} tone="text-signal-down" hint="tingkat kritis" />
          <Tile label="Diketahui" value={counts?.acknowledged} tone="text-signal-warn" hint="masih berlangsung" />
          <Tile label="Sudah pulih" value={counts?.resolved} tone="text-signal-up" hint="riwayat" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5" role="tablist">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  view === v.key
                    ? "border-accent bg-accent-dim text-ink"
                    : "border-base-600 bg-base-800 text-ink-muted hover:border-base-500 hover:text-ink"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Cari perangkat atau peringatan..." />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink focus:border-accent"
            aria-label="Filter tingkat"
          >
            <option value="">Semua tingkat</option>
            <option value="CRITICAL">{ALERT_SEVERITY_LABELS.CRITICAL}</option>
            <option value="WARNING">{ALERT_SEVERITY_LABELS.WARNING}</option>
          </select>
          </div>
        </div>

        {actionError && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{actionError}</p>}

        {isLoading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-base-700 bg-base-800 py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-signal-up" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink">
              {search ? "Tidak ada peringatan yang cocok dengan pencarian" : view === "resolved" ? "Belum ada peringatan yang pulih" : "Tidak ada peringatan"}
            </p>
            <p className="max-w-sm text-sm text-ink-muted">
              {view === "resolved"
                ? "Riwayat peringatan akan muncul setelah ada perangkat yang Off lalu pulih."
                : "Semua perangkat yang dipantau merespons dengan baik. Peringatan hanya muncul untuk perangkat dengan ping aktif."}
            </p>
          </div>
        ) : (
          <>
            <SortControl columns={ALERT_SORT_COLUMNS} sort={sort} onChange={setSort} className="mb-3" />
            <div className="overflow-x-auto rounded-md border border-base-700 bg-base-800">
              <table className="table-stack w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
                    <SortTh label="Tingkat" sortKey="severity" sort={sort} onSort={toggleSort} className={th} />
                    <SortTh label="Perangkat" sortKey="device" sort={sort} onSort={toggleSort} className={th} />
                    <SortTh label="Peringatan" sortKey="message" sort={sort} onSort={toggleSort} className={th} />
                    <SortTh label="Mulai" sortKey="triggeredAt" sort={sort} onSort={toggleSort} className={th} />
                    <th className={th}>Lama</th>
                    <SortTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} className={th} />
                    <th className={`${th} text-right`}>Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-700">
                  {data.data.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-base-700/30">
                      <td data-label="Tingkat" className="whitespace-nowrap px-3 py-2.5">
                        <Badge variant={SEVERITY_BADGE[a.severity]}>{ALERT_SEVERITY_LABELS[a.severity]}</Badge>
                      </td>
                      <td data-label="Perangkat" className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <StatusDot status={a.device.onlineStatus} showLabel={false} />
                          <Link to={`/devices/${a.device.id}`} className="font-medium text-ink hover:text-accent">
                            {a.device.name}
                          </Link>
                        </div>
                        <p className="pl-4 text-xs text-ink-faint">
                          <span className="font-mono">{a.device.ipAddress || "-"}</span>
                          {a.device.building?.name && ` · ${a.device.building.name}`}
                        </p>
                      </td>
                      <td data-label="Peringatan" className="px-3 py-2.5">
                        <p className="text-ink">{ALERT_TYPE_LABELS[a.type]}</p>
                        <p className="text-xs text-ink-muted">{a.message}</p>
                      </td>
                      <td data-label="Mulai" className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-muted">{formatDate(a.triggeredAt)}</td>
                      <td data-label="Lama" className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-muted">
                        {a.status === "RESOLVED" ? durationBetween(a.triggeredAt, a.resolvedAt) : durationSince(a.triggeredAt)}
                      </td>
                      <td data-label="Status" className="whitespace-nowrap px-3 py-2.5">
                        <Badge variant={STATUS_BADGE[a.status]}>{ALERT_STATUS_LABELS[a.status]}</Badge>
                        {a.status === "ACKNOWLEDGED" && a.acknowledgedBy && (
                          <p className="mt-0.5 text-xs text-ink-faint">oleh {a.acknowledgedBy.fullName}</p>
                        )}
                      </td>
                      <td data-label="Aksi" className="whitespace-nowrap px-3 py-2.5 text-right">
                        {a.status === "ACTIVE" && (
                          <Button size="sm" variant="ghost" onClick={() => handleAck(a.id)} disabled={busyId === a.id}>
                            <Check className="h-3.5 w-3.5" />
                            Tandai diketahui
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} unit="peringatan" />
          </>
        )}
      </div>
    {showSettings && settingsData && (
        <AlertSettingsModal
          initial={settingsData.settings}
          limits={settingsData.limits}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); refetchSettings(); refetch(); notifyChanged(); }}
        />
      )}
    </AppShell>
  );
}

function durationBetween(from, to) {
  if (!from || !to) return "-";
  const minutes = Math.max(Math.floor((new Date(to) - new Date(from)) / 60000), 0);
  if (minutes < 1) return "< 1 menit";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

function Tile({ label, value, tone, hint }) {
  return (
    <div className="rounded-md border border-base-700 bg-base-800 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value > 0 ? tone : "text-ink"}`}>{value ?? "-"}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </div>
  );
}
