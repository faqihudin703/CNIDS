import { useState, useRef } from "react";
import { Plus, Trash2, Download, FileText, Lock } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { Field } from "../ui/FormControls";
import { formatDate } from "../../utils/format";
import { uploadConfig, deleteConfig, downloadConfigFile } from "../../api/devices";

// Tab ini hanya pernah dirender untuk Admin (lihat DeviceDetailPage) —
// backend juga menolak akses viewer di endpoint ini, jadi ini lapisan kedua, bukan satu-satunya.
export default function DeviceConfigTab({ deviceId, configs, onChanged }) {
  const [showModal, setShowModal] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function handleDownload(config) {
    setBusyId(config.id);
    try {
      await downloadConfigFile(config.id, config.fileName);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(configId) {
    if (!window.confirm("Hapus backup konfigurasi ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setBusyId(configId);
    try {
      await deleteConfig(configId);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-base-700 bg-base-900 px-3 py-2.5">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <p className="text-xs text-ink-faint">
          Backup konfigurasi hanya dapat diakses oleh Admin Jaringan. Setiap unduhan tercatat di log aktivitas.
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Unggah Konfigurasi
        </Button>
      </div>

      {configs.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Belum ada backup konfigurasi untuk perangkat ini.</p>
      ) : (
        <div className="divide-y divide-base-700 rounded-md border border-base-700">
          {configs.map((config) => (
            <div key={config.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{config.fileName}</p>
                  <p className="text-xs text-ink-faint">Diunggah {formatDate(config.uploadedAt)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDownload(config)}
                  disabled={busyId === config.id}
                  className="rounded p-1.5 text-ink-muted hover:bg-base-700 hover:text-ink disabled:opacity-40"
                  title="Unduh"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  disabled={busyId === config.id}
                  className="rounded p-1.5 text-ink-muted hover:bg-base-700 hover:text-signal-down disabled:opacity-40"
                  title="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ConfigUploadModal
          deviceId={deviceId}
          onClose={() => setShowModal(false)}
          onUploaded={() => {
            setShowModal(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ConfigUploadModal({ deviceId, onClose, onUploaded }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file konfigurasi terlebih dahulu");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await uploadConfig(deviceId, file);
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal mengunggah konfigurasi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Unggah Backup Konfigurasi" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="File konfigurasi" hint="Format: .txt, .cfg, .conf, .json, atau .xml">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.cfg,.conf,.json,.xml"
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded file:border-0 file:bg-base-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-base-600"
            required
          />
        </Field>

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Mengunggah..." : "Unggah"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
