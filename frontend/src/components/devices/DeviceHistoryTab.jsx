import { useState } from "react";
import { Plus } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { Field, Select, Textarea } from "../ui/FormControls";
import { HISTORY_EVENT_LABELS, MANUAL_HISTORY_EVENTS, formatDate } from "../../utils/format";
import { addHistory } from "../../api/devices";

export default function DeviceHistoryTab({ deviceId, history, canEdit, onChanged }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Catat Riwayat
          </Button>
        </div>
      )}

      {history.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Belum ada riwayat tercatat untuk perangkat ini.</p>
      ) : (
        <ol className="space-y-0">
          {history.map((entry, i) => (
            <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
              {i < history.length - 1 && (
                <span className="absolute left-[5px] top-3 h-full w-px bg-base-700" />
              )}
              <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{HISTORY_EVENT_LABELS[entry.eventType]}</span>
                  <span className="text-xs text-ink-faint">{formatDate(entry.recordedAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{entry.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {showModal && (
        <HistoryFormModal
          deviceId={deviceId}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function HistoryFormModal({ deviceId, onClose, onSaved }) {
  const [eventType, setEventType] = useState("SERVIS");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Deskripsi kejadian wajib diisi");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addHistory(deviceId, { eventType, description });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan riwayat");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Catat Riwayat Perangkat" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Jenis kejadian">
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {MANUAL_HISTORY_EVENTS.map((value) => (
              <option key={value} value={value}>
                {HISTORY_EVENT_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Deskripsi">
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan apa yang terjadi/dilakukan pada perangkat ini..."
            autoFocus
            required
          />
        </Field>

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan Riwayat"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
