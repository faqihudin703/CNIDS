import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, MapPin } from "lucide-react";
import StatusDot from "../components/ui/StatusDot";
import AppShell from "../components/layout/AppShell";
import Panel from "../components/ui/Panel";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { LoadingState, ErrorState } from "../components/ui/States";
import DeviceForm from "../components/devices/DeviceForm";
import DeviceHistoryTab from "../components/devices/DeviceHistoryTab";
import DevicePhotoTab from "../components/devices/DevicePhotoTab";
import DevicePortTab from "../components/devices/DevicePortTab";
import DeviceConfigTab from "../components/devices/DeviceConfigTab";
import DeviceStatusPanel from "../components/devices/DeviceStatusPanel";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { getDevice, updateDevice, deleteDevice, getLatestStatus } from "../api/devices";
import { listBuildings } from "../api/buildings";
import { listAlerts } from "../api/alerts";
import { ALERT_TYPE_LABELS, ALERT_SEVERITY_LABELS } from "../utils/format";
import {
  DEVICE_TYPE_LABELS,
  areaPath,
  buildAreaTree,
  flattenAreaTree,
  formatDate,
  formatDateShort,
  durationSince,
} from "../utils/format";

const TABS = [
  { key: "ports", label: "Port", adminOnly: true },
  { key: "history", label: "Riwayat" },
  { key: "photos", label: "Foto" },
  { key: "configs", label: "Backup Konfigurasi", adminOnly: true },
];

// Muat ulang diam-diam tiap 5 dtk: hasil ping terjadwal (status, peringatan) langsung tampil tanpa refresh.
const POLL_MS = 5000;

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState(isAdmin ? "ports" : "history");
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: device, error, isLoading, refetch } = useFetch(() => getDevice(id), [id], { pollMs: POLL_MS });
  const { data: areaData } = useFetch(listBuildings, []);
  const flatAreas = useMemo(() => flattenAreaTree(buildAreaTree(areaData?.data || [])), [areaData]);
  const areaLabel = useMemo(() => {
    if (!device?.buildingId) return "Tanpa area";
    const parts = areaPath(areaData?.data || [], device.buildingId);
    return parts.length ? parts.join(" › ") : device.building?.name || "Tanpa area";
  }, [areaData, device]);
  const { data: alertData, refetch: refetchAlerts } = useFetch(
    () => (isAdmin ? listAlerts({ view: "active", deviceId: id, pageSize: 10 }) : Promise.resolve(null)),
    [id, isAdmin],
    { pollMs: POLL_MS }
  );
  const openAlerts = alertData?.data || [];
  const {
    data: latestStatus,
    refetch: refetchStatus,
  } = useFetch(
    () => (device && device.monitorMethod !== "NONE" ? getLatestStatus(id) : Promise.resolve(null)),
    [id, device?.monitorMethod],
    { pollMs: POLL_MS }
  );

  async function handleUpdate(payload) {
    await updateDevice(id, payload);
    setShowEditModal(false);
    refetch();
  }

  async function handleDelete() {
    if (!window.confirm(`Hapus perangkat "${device.name}"? Seluruh riwayat, foto, dan backup konfigurasi terkait akan ikut terhapus.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteDevice(id);
      navigate("/devices", { replace: true });
    } catch (err) {
      window.alert(err.response?.data?.error || "Gagal menghapus perangkat");
      setIsDeleting(false);
    }
  }

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <AppShell
      title={
        <Link to="/devices" className="inline-flex items-center gap-2 text-ink hover:text-accent">
          <ArrowLeft className="h-4 w-4" />
          {device?.name || "Detail Perangkat"}
        </Link>
      }
      description={device && `${DEVICE_TYPE_LABELS[device.type]}${device.model ? ` · ${device.model}` : ""} · ${areaLabel}`}
      action={
        isAdmin &&
        device && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" aria-label="Ubah perangkat" onClick={() => setShowEditModal(true)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ubah</span>
            </Button>
            <Button variant="danger" size="sm" aria-label="Hapus perangkat" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isDeleting ? "Menghapus..." : "Hapus"}</span>
            </Button>
          </div>
        )
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          {openAlerts.length > 0 && (
            <div className="rounded-md border border-signal-down/40 bg-signal-down-dim/40 px-4 py-3">
              {openAlerts.map((a) => (
                <p key={a.id} className="flex flex-wrap items-center gap-x-2 text-sm text-ink">
                  <span className="font-medium text-signal-down">{ALERT_SEVERITY_LABELS[a.severity]}</span>
                  <span>{ALERT_TYPE_LABELS[a.type]}</span>
                  <span className="text-ink-muted">· {a.message} · sejak {formatDate(a.triggeredAt)}</span>
                </p>
              ))}
              <Link to="/warnings" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
                Lihat semua peringatan
              </Link>
            </div>
          )}
          <Panel title="Ringkasan">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Status</p>
                <StatusDot status={device.onlineStatus} />
              </div>
              <InfoField label="Serial number" value={device.serialNumber} mono />
              <InfoField label="Model / tipe" value={device.model} />
              <InfoField label="Merek" value={device.vendor} />
              <InfoField label="IP manajemen" value={device.ipAddress} mono />
              {isAdmin && <InfoField label="MAC address" value={device.macAddress} mono />}
              {isAdmin && <InfoField label="Versi firmware" value={device.firmwareVersion} />}
              <InfoField label="Area/Gedung" value={areaLabel} icon={MapPin} />
              <InfoField label="Lokasi presisi" value={device.location} icon={MapPin} />
              <InfoField label="Tanggal pemasangan" value={device.installedAt ? formatDateShort(device.installedAt) : null} />
              <InfoField label="Terakhir On" value={device.lastOnlineAt ? formatDate(device.lastOnlineAt) : null} />
              {device.onlineStatus === "OFF" && (
                <InfoField label="Off sejak" value={`${formatDate(device.offlineSince)} (${durationSince(device.offlineSince)})`} />
              )}
            </div>
            {device.description && (
              <div className="mt-4 border-t border-base-700 pt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Deskripsi</p>
                <p className="text-sm text-ink-muted">{device.description}</p>
              </div>
            )}
            {isAdmin && device.notes && (
              <div className="mt-4 border-t border-base-700 pt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Catatan internal</p>
                <p className="text-sm text-ink-muted">{device.notes}</p>
              </div>
            )}
          </Panel>

          <Panel title="Status Monitoring">
            <DeviceStatusPanel
              deviceId={id}
              monitorMethod={device.monitorMethod}
              pingIntervalSec={device.pingIntervalSec}
              latestStatus={latestStatus}
              canCheck={isAdmin}
              onChecked={() => Promise.all([refetch(), refetchStatus(), refetchAlerts()])}
            />
          </Panel>

          <div>
            <div className="mb-3 flex gap-1 border-b border-base-700">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "border-accent text-ink"
                      : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Panel>
              {activeTab === "ports" && isAdmin && (
                <DevicePortTab deviceId={id} onChanged={refetch} />
              )}
              {activeTab === "history" && (
                <DeviceHistoryTab
                  deviceId={id}
                  history={device.history || []}
                  canEdit={isAdmin}
                  onChanged={refetch}
                />
              )}
              {activeTab === "photos" && (
                <DevicePhotoTab
                  deviceId={id}
                  photos={device.photos || []}
                  canEdit={isAdmin}
                  onChanged={refetch}
                />
              )}
              {activeTab === "configs" && isAdmin && (
                <DeviceConfigTab deviceId={id} configs={device.configs || []} onChanged={refetch} />
              )}
            </Panel>
          </div>
        </div>
      )}

      {showEditModal && device && (
        <Modal title="Ubah Perangkat" width="max-w-2xl" onClose={() => setShowEditModal(false)}>
          <DeviceForm
            areas={flatAreas}
            initialValues={{
              name: device.name,
              serialNumber: device.serialNumber || "",
              type: device.type,
              vendor: device.vendor || "",
              model: device.model || "",
              ipAddress: device.ipAddress || "",
              macAddress: device.macAddress || "",
              firmwareVersion: device.firmwareVersion || "",
              buildingId: device.buildingId ?? "",
              location: device.location || "",
              description: device.description || "",
              installedAt: device.installedAt ? String(device.installedAt).slice(0, 10) : "",
              monitorMethod: device.monitorMethod,
              pingIntervalSec: device.pingIntervalSec ?? 300,
              notes: device.notes || "",
            }}
            onSubmit={handleUpdate}
            onCancel={() => setShowEditModal(false)}
            submitLabel="Simpan Perubahan"
          />
        </Modal>
      )}
    </AppShell>
  );
}

function InfoField({ label, value, icon: Icon, mono }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />}
        <p className={`truncate text-sm text-ink ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
      </div>
    </div>
  );
}
