import { Link } from "react-router-dom";
import { Server, MapPin, Cable, Network, Boxes, ArrowRight } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Panel from "../components/ui/Panel";
import Badge from "../components/ui/Badge";
import { LoadingState, ErrorState } from "../components/ui/States";
import { StatCard, BarList, Donut, CoverageRow } from "../components/dashboard/widgets";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { getDashboardSummary } from "../api/dashboard";
import { DEVICE_TYPE_LABELS, ONLINE_STATUS_LABELS, PORT_MODE_LABELS, ROLE_LABELS, timeAgo } from "../utils/format";
import StatusDot from "../components/ui/StatusDot";

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

const MODE_STYLE = {
  ACCESS: { strokeClass: "stroke-accent", dotClass: "bg-accent" },
  TRUNK: { strokeClass: "stroke-signal-warn", dotClass: "bg-signal-warn" },
  NO_VLAN: { strokeClass: "stroke-base-500", dotClass: "bg-base-500" },
};

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data, error, isLoading, refetch } = useFetch(getDashboardSummary, [], { pollMs: 10000 });

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell title="Dashboard" description="Ringkasan dokumentasi infrastruktur jaringan UPPTIK">
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !isValidSummary(data) ? (
        <ErrorState
          message="Respons API dashboard tidak sesuai (bukan JSON dari backend). Biasanya /api belum di-proxy ke backend, atau versi backend lebih lama dari frontend."
          onRetry={refetch}
        />
      ) : (
        <DashboardBody data={data} user={user} isAdmin={isAdmin} greeting={greeting()} today={today} />
      )}
    </AppShell>
  );
}

function isValidSummary(d) {
  return !!d && typeof d === "object" && Array.isArray(d.devicesByType) && Array.isArray(d.areas) && Array.isArray(d.recentDevices);
}

function DashboardBody({ data, user, isAdmin, greeting, today }) {
  const { totals, devicesByType, devicesByStatus, areas, recentDevices, admin } = data;

  const typeItems = devicesByType.map((t) => ({
    key: t.type,
    label: DEVICE_TYPE_LABELS[t.type] || t.type,
    count: t.count,
  }));
  const areaItems = areas.map((a) => ({ key: a.id, label: a.name, count: a.count }));

  // Urutan tetap Access, Trunk, Tanpa VLAN agar legenda konsisten walau datanya kosong.
  const modeSegments = admin
    ? ["ACCESS", "TRUNK", "NO_VLAN"].map((mode) => ({
        label: PORT_MODE_LABELS[mode],
        value: admin.portsByMode.find((m) => m.mode === mode)?.count ?? 0,
        ...MODE_STYLE[mode],
      }))
    : [];

  const mon = admin?.monitoring;

  const statusSegments = [
    { key: "ON", strokeClass: "stroke-signal-up", dotClass: "bg-signal-up" },
    { key: "OFF", strokeClass: "stroke-signal-down", dotClass: "bg-signal-down" },
    { key: "NEVER_ON", strokeClass: "stroke-base-500", dotClass: "bg-base-500" },
  ].map(({ key, ...style }) => ({
    label: ONLINE_STATUS_LABELS[key],
    value: (devicesByStatus || []).find((r) => r.status === key)?.count ?? 0,
    ...style,
  }));

  return (
    <div className="space-y-6">
      {/* Sambutan */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-base-700 border-l-2 border-l-accent bg-base-800 px-5 py-4">
        <div>
          <p className="text-xl font-semibold text-ink">
            {greeting}, {user?.fullName?.split(" ")[0] || ""}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">{today}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">{ROLE_LABELS[user?.role]}</Badge>
          {isAdmin && (
            <>
              <Link to="/devices" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Kelola perangkat <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/ipam" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Lihat IPAM <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Angka utama */}
      <div className={`grid grid-cols-2 gap-4 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <StatCard icon={Server} label="Perangkat terdokumentasi" value={totals.devices} to="/devices" />
        <StatCard
          icon={MapPin}
          label="Area/Gedung"
          value={totals.areas}
          hint={totals.unassignedDevices > 0 ? `${totals.unassignedDevices} perangkat belum punya area` : undefined}
          to="/buildings"
        />
        {isAdmin ? (
          <>
            <StatCard icon={Cable} label="Port tercatat" value={totals.ports} />
            <StatCard icon={Network} label="Alamat IP terdata" value={totals.ips} to="/ipam" />
          </>
        ) : (
          <StatCard icon={Boxes} label="Jenis perangkat" value={devicesByType.length} />
        )}
      </div>

      {/* Sebaran + status ping */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Perangkat per area/gedung" className={isAdmin ? "lg:col-span-2" : "lg:col-span-2"}>
          <BarList items={areaItems} empty="Belum ada area/gedung terdaftar." />
        </Panel>

        <Panel title="Status perangkat">
          {totals.devices === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Belum ada perangkat yang terdokumentasi.</p>
          ) : (
            <div className="space-y-4">
              <Donut segments={statusSegments} centerValue={totals.devices} centerLabel="total" />
              {isAdmin && mon.downDevices.length > 0 && (
                <ul className="space-y-1.5 border-t border-base-700 pt-3">
                  {mon.downDevices.map((d) => (
                    <li key={d.id}>
                      <Link to={`/devices/${d.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-accent">
                        <span className="truncate text-ink">{d.name}</span>
                        <span className="shrink-0 font-mono text-xs text-signal-down">{d.ipAddress || "-"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {isAdmin && admin.alerts?.open > 0 && (
                <Link
                  to="/warnings"
                  className="flex items-center justify-between rounded border border-signal-down/40 bg-signal-down-dim/40 px-3 py-2 text-sm text-ink hover:border-signal-down"
                >
                  <span>
                    <span className="font-semibold text-signal-down">{admin.alerts?.open}</span> peringatan aktif
                    {admin.alerts?.critical > 0 && ` (${admin.alerts?.critical} kritis)`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
                </Link>
              )}
              {isAdmin && mon.total === 0 && (
                <p className="border-t border-base-700 pt-3 text-xs text-ink-faint">
                  Aktifkan ping di form perangkat agar status On/Off terbarui otomatis.
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>

      {!isAdmin && (
        <Panel title="Jenis perangkat">
          <BarList items={typeItems} barClass="bg-accent/70" />
        </Panel>
      )}

      {/* Hanya Admin: komposisi dan kelengkapan */}
      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Jenis perangkat">
            <BarList items={typeItems} barClass="bg-accent/70" />
          </Panel>

          <Panel title="Mode port">
            {totals.ports === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Belum ada port tercatat.</p>
            ) : (
              <Donut segments={modeSegments} centerValue={totals.ports} centerLabel="port" />
            )}
          </Panel>

          <Panel title="Kelengkapan dokumentasi">
            <div className="space-y-4">
              <CoverageRow label="Lokasi presisi" done={admin.coverage.withLocation} total={admin.coverage.devices} />
              <CoverageRow label="Daftar port" done={admin.coverage.withPorts} total={admin.coverage.devices} />
              <CoverageRow label="Foto perangkat" done={admin.coverage.withPhoto} total={admin.coverage.devices} />
              <CoverageRow label="Backup konfigurasi" done={admin.coverage.withConfig} total={admin.coverage.devices} />
            </div>
          </Panel>
        </div>
      )}

      {/* Terbaru */}
      <div className={`grid gap-4 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        <Panel
          title="Perangkat terbaru diperbarui"
          action={
            <Link to="/devices" className="text-sm font-medium text-accent hover:underline">
              Lihat semua
            </Link>
          }
        >
          {recentDevices.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Belum ada perangkat yang terdokumentasi.</p>
          ) : (
            <div className="divide-y divide-base-700">
              {recentDevices.map((d) => (
                <Link
                  key={d.id}
                  to={`/devices/${d.id}`}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 hover:text-accent"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                      <StatusDot status={d.onlineStatus} showLabel={false} />
                      {d.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {d.model || DEVICE_TYPE_LABELS[d.type]} · {d.building?.name || "Tanpa area"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {d.ipAddress && <p className="font-mono text-xs text-ink-muted">{d.ipAddress}</p>}
                    <p className="text-xs text-ink-faint">{timeAgo(d.updatedAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {isAdmin && (
          <Panel
            title="Aktivitas terbaru"
            action={
              <Link to="/activity-logs" className="text-sm font-medium text-accent hover:underline">
                Lihat semua
              </Link>
            }
          >
            {admin.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Belum ada aktivitas tercatat.</p>
            ) : (
              <ul className="space-y-3">
                {admin.recentActivity.map((log) => (
                  <li key={log.id} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{log.action}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {log.userName || "Sistem"} · {timeAgo(log.loggedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs text-ink-faint">
          Anda masuk sebagai User: hanya informasi non-sensitif yang ditampilkan. Detail port, IPAM, dan backup
          konfigurasi hanya dapat diakses oleh Admin Jaringan.
        </p>
      )}
    </div>
  );
}
