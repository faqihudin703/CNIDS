import { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Field, Input, Select } from "../ui/FormControls";
import { updateAlertSettings } from "../../api/alerts";
import { SEVERITY_OPTIONS, validateSettings } from "../../utils/alertSettings";

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent,#5b8def)]" />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-faint">{hint}</span>
      </span>
    </label>
  );
}

const SeveritySelect = ({ value, onChange, label }) => (
  <Field label="Tingkat peringatan">
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {SEVERITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  </Field>
);

// Khusus Superadmin: aturan kapan peringatan dibuat. Berlaku untuk semua perangkat pada pengecekan ping berikutnya.
export default function AlertSettingsModal({ initial, limits, onClose, onSaved }) {
  const [form, setForm] = useState({ ...initial });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const errors = validateSettings(form, limits);
  const show = touched ? errors : {};

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length) return;
    setIsSaving(true);
    try {
      const saved = await updateAlertSettings({
        ...form,
        offlineAfterFailures: Number(form.offlineAfterFailures),
        latencyThresholdMs: Number(form.latencyThresholdMs),
      });
      onSaved(saved);
    } catch (err) {
      const d = err.response?.data?.details;
      setError(d?.length ? d.map((x) => x.message).join(". ") : err.response?.data?.error || "Gagal menyimpan pengaturan");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title="Pengaturan Peringatan" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <p className="text-xs text-ink-faint">Berlaku untuk semua perangkat mulai pengecekan ping berikutnya. Hanya Superadmin yang dapat mengubahnya.</p>

        <fieldset className="space-y-3 rounded border border-base-700 p-3.5">
          <Toggle checked={form.offlineEnabled} onChange={(v) => set("offlineEnabled", v)} label="Peringatan perangkat Off" hint="Dibuat saat perangkat yang pernah On tidak lagi merespons ping." />
          {form.offlineEnabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Ping gagal berturut-turut" hint="1 = langsung saat gagal. Naikkan agar gangguan sesaat tidak memicu peringatan." error={show.offlineAfterFailures}>
                <Input type="number" min={limits?.failures?.[0] ?? 1} max={limits?.failures?.[1] ?? 10} step="1" value={form.offlineAfterFailures} onChange={(e) => set("offlineAfterFailures", e.target.value)} aria-label="Ping gagal berturut-turut" className="font-mono" />
              </Field>
              <SeveritySelect value={form.offlineSeverity} onChange={(v) => set("offlineSeverity", v)} label="Tingkat peringatan Off" />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded border border-base-700 p-3.5">
          <Toggle checked={form.latencyEnabled} onChange={(v) => set("latencyEnabled", v)} label="Peringatan latensi tinggi" hint="Dibuat saat ping berhasil tetapi waktu balasnya melewati ambang." />
          {form.latencyEnabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Ambang latensi (ms)" hint="Peringatan dibuka bila latensi sama dengan atau lebih dari nilai ini." error={show.latencyThresholdMs}>
                <Input type="number" min={limits?.latencyMs?.[0] ?? 10} max={limits?.latencyMs?.[1] ?? 10000} step="1" value={form.latencyThresholdMs} onChange={(e) => set("latencyThresholdMs", e.target.value)} aria-label="Ambang latensi" className="font-mono" />
              </Field>
              <SeveritySelect value={form.latencySeverity} onChange={(v) => set("latencySeverity", v)} label="Tingkat peringatan latensi" />
            </div>
          )}
        </fieldset>

        {(!form.offlineEnabled || !form.latencyEnabled) && (
          <p className="rounded bg-base-900 px-3 py-2 text-xs text-ink-muted">Jenis yang dimatikan tidak dibuat lagi, dan peringatannya yang masih terbuka ditutup pada pengecekan berikutnya.</p>
        )}
        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Batal</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
        </div>
      </form>
    </Modal>
  );
}
