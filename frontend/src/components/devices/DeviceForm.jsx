import { useState } from "react";
import { Field, Input, Select, Textarea } from "../ui/FormControls";
import Button from "../ui/Button";
import { DEVICE_TYPE_LABELS } from "../../utils/format";
import { sanitizeIp, ipError, formatMac, macError, splitInterval, toSeconds, intervalError, PING_UNITS, PING_MIN, PING_MAX } from "../../utils/netInput";

const MONITOR_METHOD_LABELS = {
  NONE: "Tidak diaktifkan (status tetap Never On)",
  ICMP: "Ping (ICMP) — status On/Off otomatis",
};

const emptyForm = {
  name: "",
  serialNumber: "",
  type: "LAINNYA",
  vendor: "",
  model: "",
  ipAddress: "",
  macAddress: "",
  firmwareVersion: "",
  buildingId: "",
  location: "",
  description: "",
  installedAt: "",
  monitorMethod: "NONE",
  pingIntervalSec: 300,
  notes: "",
};

// Field teks opsional yang boleh dikosongkan; dikirim apa adanya ("" -> null di backend).
export default function DeviceForm({ areas, initialValues, onSubmit, onCancel, submitLabel = "Simpan" }) {
  const [form, setForm] = useState({ ...emptyForm, ...initialValues });
  // Jeda ping diketik sebagai angka + satuan (detik/menit/jam), dikirim sebagai detik.
  const [ping, setPing] = useState(() => splitInterval(initialValues?.pingIntervalSec ?? emptyForm.pingIntervalSec));
  const [touched, setTouched] = useState({}); // galat IP/MAC baru tampil setelah kolomnya ditinggalkan atau saat simpan
  const touch = (f) => setTouched((t) => ({ ...t, [f]: true }));
  const ipErr = ipError(form.ipAddress);
  const macErr = macError(form.macAddress);
  const pingErr = form.monitorMethod === "ICMP" ? intervalError(ping.value, ping.unit) : null;
  const [error, setError] = useState(null);
  const [snError, setSnError] = useState(null); // bentrok SN ditampilkan tepat di bawah kolom SN
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Nama perangkat wajib diisi");
      return;
    }
    if (ipErr || macErr || pingErr) {
      setTouched({ ipAddress: true, macAddress: true, ping: true });
      setError(ipErr || macErr || pingErr);
      return;
    }
    if (form.monitorMethod === "ICMP" && !form.ipAddress.trim()) {
      setTouched((t) => ({ ...t, ipAddress: true }));
      setError("IP manajemen wajib diisi untuk mengaktifkan ping");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...form,
        buildingId: form.buildingId ? Number(form.buildingId) : null,
        installedAt: form.installedAt || null,
        ipAddress: form.ipAddress.trim(),
        pingIntervalSec: form.monitorMethod === "ICMP" ? toSeconds(ping.value, ping.unit) : form.pingIntervalSec,
      });
    } catch (err) {
      const details = err.response?.data?.details;
      const msg = err.response?.data?.error || "";
      if (err.response?.status === 409 && /serial number/i.test(msg)) {
        setSnError(msg);
        setError(null);
        return;
      }
      setError(
        details?.length
          ? details.map((d) => d.message).join(". ")
          : err.response?.data?.error || "Gagal menyimpan perangkat"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Identitas">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nama / alias">
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} autoFocus required />
          </Field>
          <Field label="Serial number (SN)" hint="Unik: satu SN hanya untuk satu perangkat. Spasi dirapikan dan huruf diubah ke kapital." error={snError}>
            <Input
              value={form.serialNumber}
              onChange={(e) => { setSnError(null); update("serialNumber", e.target.value); }}
              aria-invalid={Boolean(snError)}
              placeholder="G1QH12345678"
              className="font-mono"
            />
          </Field>
          <Field label="Jenis perangkat">
            <Select value={form.type} onChange={(e) => update("type", e.target.value)}>
              {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Merek">
            <Input value={form.vendor} onChange={(e) => update("vendor", e.target.value)} placeholder="Ruijie, Cisco, MikroTik" />
          </Field>
          <Field label="Model / tipe">
            <Input value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="RG-S2910-24GT4XS-E" />
          </Field>
          <Field label="Tanggal pemasangan">
            <Input type="date" value={form.installedAt} onChange={(e) => update("installedAt", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Jaringan">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="IP manajemen" hint="Hanya angka dan titik, contoh: 192.168.1.10" error={touched.ipAddress ? ipErr : null}>
            <Input
              value={form.ipAddress}
              onChange={(e) => update("ipAddress", sanitizeIp(e.target.value))}
              onBlur={() => touch("ipAddress")}
              aria-invalid={Boolean(touched.ipAddress && ipErr)}
              inputMode="decimal"
              placeholder="192.168.1.10"
              className="font-mono"
            />
          </Field>
          <Field label="MAC address" hint="Angka 0-9 dan huruf A-F; tanda titik dua ditambahkan otomatis" error={touched.macAddress ? macErr : null}>
            <Input
              value={form.macAddress}
              onChange={(e) => update("macAddress", formatMac(e.target.value))}
              onBlur={() => touch("macAddress")}
              aria-invalid={Boolean(touched.macAddress && macErr)}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="00:D0:F8:12:34:56"
              className="font-mono"
            />
          </Field>
          <Field label="Versi firmware">
            <Input value={form.firmwareVersion} onChange={(e) => update("firmwareVersion", e.target.value)} placeholder="ReyeeOS 2.320" />
          </Field>
          <Field label="Pemantauan status" hint="Hanya ping. Detail port dicatat di tab Port">
            <Select value={form.monitorMethod} onChange={(e) => update("monitorMethod", e.target.value)}>
              {Object.entries(MONITOR_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {form.monitorMethod === "ICMP" && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-ink">Jeda ping perangkat ini</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Ping tiap</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={ping.value}
                  onChange={(e) => setPing((p) => ({ ...p, value: e.target.value }))}
                  onBlur={() => touch("ping")}
                  aria-label="Jeda ping"
                  aria-invalid={Boolean(touched.ping && pingErr)}
                  className="!w-24 shrink-0 font-mono"
                />
                <Select value={ping.unit} onChange={(e) => setPing((p) => ({ ...p, unit: e.target.value }))} aria-label="Satuan jeda ping" className="!w-32">
                  {PING_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              </div>
              <p className={`mt-1 text-xs ${touched.ping && pingErr ? "text-signal-down" : "text-ink-faint"}`}>
                {touched.ping && pingErr ? pingErr : `Bebas per perangkat, ${PING_MIN} detik sampai 24 jam (${PING_MAX} detik). Ping pertama langsung dijalankan saat disimpan.`}
              </p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Lokasi">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Area/Gedung">
            <Select value={form.buildingId} onChange={(e) => update("buildingId", e.target.value)}>
              <option value="">Tanpa area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lokasi presisi" hint="Contoh: Lantai 2, Ruang Server">
            <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Lantai 2, Ruang Server" />
          </Field>
        </div>
      </Section>

      <Section title="Keterangan">
        <div className="space-y-3">
          <Field label="Deskripsi" hint="Singkat, terlihat oleh semua pengguna">
            <Input value={form.description} onChange={(e) => update("description", e.target.value)} />
          </Field>
          <Field label="Catatan internal">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Catatan teknis tambahan (hanya terlihat oleh Admin)"
            />
          </Field>
        </div>
      </Section>

      {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{title}</legend>
      {children}
    </fieldset>
  );
}
