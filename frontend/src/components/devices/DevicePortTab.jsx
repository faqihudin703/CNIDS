import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ListPlus, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Modal from "../ui/Modal";
import PoolHint from "../ui/PoolHint";
import { Field, Input } from "../ui/FormControls";
import { PORT_MODE_LABELS, PORT_MODE_HINTS, PORT_MODE_FIELDS, PORT_MODE_BADGE } from "../../utils/format";
import { computePool, isValidIp } from "../../utils/ipPool";
import { useSort } from "../../hooks/useSort";
import { matchesQuery, facetOptions } from "../../utils/filter";
import { SearchBox, FilterSelect } from "../ui/FilterBar";
import { sanitizeIp } from "../../utils/netInput";
import { sortRows, ipSortKey, prefixNumber } from "../../utils/sort";
import { SortTh, SortControl } from "../ui/SortControls";
import { listPorts, createPort, generatePorts, updatePort, deletePort } from "../../api/devices";

const PORT_SEARCH = [
  (p) => p.interfaceName, (p) => p.ipInterface, (p) => p.prefix, (p) => p.vlan,
  (p) => PORT_MODE_LABELS[p.portMode], (p) => p.description,
];
const PORT_SORT = {
  interfaceName: (p) => p.interfaceName,
  ipInterface: (p) => ipSortKey(p.ipInterface),
  prefix: (p) => prefixNumber(p.prefix),
  vlan: (p) => p.vlan,
  portMode: (p) => PORT_MODE_LABELS[p.portMode] ?? p.portMode,
  description: (p) => p.description,
};
const PORT_SORT_COLUMNS = [
  { key: "interfaceName", label: "Interface" },
  { key: "ipInterface", label: "IP Interface" },
  { key: "prefix", label: "Prefix" },
  { key: "vlan", label: "VLAN" },
  { key: "portMode", label: "Mode" },
  { key: "description", label: "Keterangan" },
];

const PAGE_SIZE = 15;

function apiError(err, fallback) {
  const details = err.response?.data?.details;
  if (details?.length) return details.map((d) => d.message).join(". ");
  if (err.response?.status === 409) return "Nama interface sudah dipakai pada perangkat ini";
  return err.response?.data?.error || fallback;
}

// Tab ini hanya dirender untuk Admin (backend juga menolak akses viewer pada endpoint port).
export default function DevicePortTab({ deviceId, onChanged }) {
  const [allPorts, setAllPorts] = useState(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingPort, setEditingPort] = useState(null); // null = tutup, {} = tambah, {id,...} = ubah
  const [showGenerate, setShowGenerate] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function reload() {
    const res = await listPorts(deviceId);
    setAllPorts(res.data);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  function handleChanged() {
    reload();
    onChanged?.();
  }

  const { sort, toggle, setSort } = useSort();

  // Pencarian memakai teks kolom yang tampil (Interface, IP, Prefix, VLAN, Mode, Keterangan); opsi mode dibangun dari
  // port yang lolos pencarian, lengkap dengan jumlahnya.
  const searchMatched = useMemo(
    () => (allPorts ?? []).filter((p) => matchesQuery(p, search, PORT_SEARCH)),
    [allPorts, search]
  );
  const modeOptions = useMemo(() => {
    const opts = facetOptions(searchMatched, (p) => p.portMode, (v) => PORT_MODE_LABELS[v] ?? v);
    return modeFilter && !opts.some((o) => o.value === modeFilter)
      ? [{ value: modeFilter, label: PORT_MODE_LABELS[modeFilter] ?? modeFilter, count: 0 }, ...opts]
      : opts;
  }, [searchMatched, modeFilter]);
  const filtered = useMemo(
    () => sortRows(modeFilter ? searchMatched.filter((p) => p.portMode === modeFilter) : searchMatched, sort, PORT_SORT),
    [searchMatched, modeFilter, sort]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, modeFilter, sort]);

  const countByMode = (mode) => allPorts?.filter((p) => p.portMode === mode).length ?? 0;

  async function handleDelete(port) {
    if (!window.confirm(`Hapus port "${port.interfaceName}"?`)) return;
    setBusyId(port.id);
    try {
      await deletePort(port.id);
      handleChanged();
    } finally {
      setBusyId(null);
    }
  }

  if (allPorts === null) {
    return <p className="py-10 text-center text-sm text-ink-muted">Memuat data port...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <SearchBox value={search} onChange={setSearch} placeholder="Cari interface, IP, prefix, VLAN, mode..." />
          <FilterSelect label="Semua mode" value={modeFilter} onChange={setModeFilter} options={modeOptions} />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowGenerate(true)}>
            <ListPlus className="h-4 w-4" />
            Buat Rentang
          </Button>
          <Button size="sm" onClick={() => setEditingPort({})}>
            <Plus className="h-4 w-4" />
            Tambah Port
          </Button>
        </div>
      </div>

      {allPorts.length > 0 && (
        <p className="text-xs text-ink-faint">
          {allPorts.length} port · {countByMode("ACCESS")} access · {countByMode("TRUNK")} trunk ·{" "}
          {countByMode("NO_VLAN")} tanpa VLAN
          {filtered.length !== allPorts.length && ` · ${filtered.length} cocok dengan filter`}
        </p>
      )}

      {allPorts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-ink-muted">Belum ada port tercatat untuk perangkat ini.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Gunakan &ldquo;Buat Rentang&rdquo; untuk membuat banyak port sekaligus, mis. Gi0/1 sampai Gi0/48.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Tidak ada port yang cocok dengan filter.</p>
      ) : (
        <>
          <SortControl columns={PORT_SORT_COLUMNS} sort={sort} onChange={setSort} />
          <div className="overflow-x-auto rounded-md border border-base-700">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <SortTh label="Interface" sortKey="interfaceName" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="IP Interface" sortKey="ipInterface" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Prefix" sortKey="prefix" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="VLAN" sortKey="vlan" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Mode" sortKey="portMode" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Keterangan" sortKey="description" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700">
                {pageItems.map((port) => (
                  <tr key={port.id} className="transition-colors hover:bg-base-700/30">
                    <td data-label="Interface" className="whitespace-nowrap px-3 py-2 font-mono text-ink">{port.interfaceName}</td>
                    <td data-label="IP Interface" className="whitespace-nowrap px-3 py-2 font-mono text-ink-muted">
                      {port.ipInterface || "-"}
                    </td>
                    <td data-label="Prefix" className="whitespace-nowrap px-3 py-2 text-ink-muted">
                      {port.prefix ? <PoolHint pool={port.pool}>{port.prefix}</PoolHint> : "-"}
                    </td>
                    <td data-label="VLAN" className="whitespace-nowrap px-3 py-2 text-ink-muted">{port.vlan || "-"}</td>
                    <td data-label="Mode" className="whitespace-nowrap px-3 py-2">
                      <Badge variant={PORT_MODE_BADGE[port.portMode]}>{PORT_MODE_LABELS[port.portMode]}</Badge>
                    </td>
                    <td data-label="Keterangan" className="px-3 py-2 text-ink-muted">{port.description || "-"}</td>
                    <td data-label="" className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => setEditingPort(port)}
                          className="rounded p-1.5 text-ink-muted hover:bg-base-700 hover:text-ink"
                          title="Ubah"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(port)}
                          disabled={busyId === port.id}
                          className="rounded p-1.5 text-ink-muted hover:bg-base-700 hover:text-signal-down disabled:opacity-40"
                          title="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-faint">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded p-1.5 text-ink-muted hover:bg-base-700 hover:text-ink disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded p-1.5 text-ink-muted hover:bg-base-700 hover:text-ink disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {editingPort && (
        <PortFormModal
          deviceId={deviceId}
          port={editingPort}
          onClose={() => setEditingPort(null)}
          onSaved={() => {
            setEditingPort(null);
            handleChanged();
          }}
        />
      )}

      {showGenerate && (
        <GeneratePortsModal
          deviceId={deviceId}
          onClose={() => setShowGenerate(false)}
          onSaved={() => {
            setShowGenerate(false);
            handleChanged();
          }}
        />
      )}
    </div>
  );
}

// Bukan <Field>: Field membungkus <label>, dan klik pada label akan memicu tombol pertama di dalamnya.
function ModeSelector({ value, onChange }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">Mode port</p>
      <div className="grid grid-cols-3 gap-1 rounded-md border border-base-600 bg-base-900 p-1" role="radiogroup">
        {Object.entries(PORT_MODE_LABELS).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value === mode}
            onClick={() => onChange(mode)}
            className={`rounded px-2 py-1.5 text-sm font-medium transition-colors ${
              value === mode ? "bg-accent-dim text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">{PORT_MODE_HINTS[value]}</p>
    </div>
  );
}

function PortFormModal({ deviceId, port, onClose, onSaved }) {
  const isEdit = Boolean(port.id);
  const [form, setForm] = useState({
    interfaceName: port.interfaceName || "",
    portMode: port.portMode || "ACCESS",
    vlan: port.vlan || "",
    ipInterface: port.ipInterface || "",
    prefixNum: port.prefix ? port.prefix.replace("/", "") : "",
    description: port.description || "",
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const fields = PORT_MODE_FIELDS[form.portMode];

  const ip = form.ipInterface.trim();
  const prefix = form.prefixNum !== "" ? `/${form.prefixNum}` : "";
  const pool = fields.ip ? computePool(ip, prefix) : null;

  function validate() {
    if (!form.interfaceName.trim()) return "Nama interface wajib diisi";
    if (fields.vlan && !form.vlan.trim()) return `Port ${PORT_MODE_LABELS[form.portMode]} wajib memiliki VLAN`;
    if (fields.ip) {
      const n = Number(form.prefixNum);
      if (ip && !isValidIp(ip)) return "IP interface harus berupa angka dan titik, 4 bagian 0-255 (contoh 192.168.10.1)";
      if (form.prefixNum !== "" && !(Number.isInteger(n) && n >= 0 && n <= 32)) return "Prefix harus 0 sampai 32";
      if (Boolean(ip) !== (form.prefixNum !== "")) return "IP interface dan prefix harus diisi berpasangan";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    // Field yang tidak berlaku pada mode terpilih dikirim kosong, supaya nilai lama ikut terhapus.
    const payload = {
      interfaceName: form.interfaceName.trim(),
      portMode: form.portMode,
      vlan: fields.vlan ? form.vlan.trim() : "",
      ipInterface: fields.ip ? ip : "",
      prefix: fields.ip ? prefix : "",
      description: form.description.trim(),
    };
    try {
      if (isEdit) await updatePort(port.id, payload);
      else await createPort(deviceId, payload);
      onSaved();
    } catch (err) {
      setError(apiError(err, "Gagal menyimpan port"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? "Ubah Port" : "Tambah Port"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Interface">
          <Input
            value={form.interfaceName}
            onChange={(e) => update("interfaceName", e.target.value)}
            placeholder="Gi0/1"
            autoFocus
            required
          />
        </Field>

        <ModeSelector value={form.portMode} onChange={(m) => update("portMode", m)} />

        {fields.vlan && (
          <Field
            label="VLAN"
            hint={form.portMode === "TRUNK" ? "Boleh lebih dari satu, contoh: 10,20,30 atau 10-50" : "Contoh: 10"}
          >
            <Input value={form.vlan} onChange={(e) => update("vlan", e.target.value)} placeholder="10" />
          </Field>
        )}

        {fields.ip && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">
              Alamat IP <span className="font-normal text-ink-faint">(opsional)</span>
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={form.ipInterface}
                onChange={(e) => update("ipInterface", sanitizeIp(e.target.value))}
                inputMode="decimal"
                placeholder="192.168.10.1"
                className="min-w-0 flex-1 font-mono"
                aria-label="IP interface"
              />
              <span className="text-ink-faint">/</span>
              <Input
                type="number"
                min="0"
                max="32"
                value={form.prefixNum}
                onChange={(e) => update("prefixNum", e.target.value)}
                placeholder="24"
                className="!w-20 shrink-0"
                aria-label="Prefix CIDR"
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              Isi IP dan prefix sekaligus, atau kosongkan keduanya. IP pool dihitung otomatis.
            </p>
            {pool && (
              <p className="mt-2 rounded border border-base-700 bg-base-900 px-3 py-2 text-xs text-ink-muted">
                Pool <span className="font-mono text-ink">{pool.range}</span> · network{" "}
                <span className="font-mono text-ink">{pool.cidr}</span> · {pool.hosts.toLocaleString("id-ID")} host
              </p>
            )}
          </div>
        )}

        <Field label="Keterangan" hint="Perangkat atau tujuan yang terhubung ke port ini">
          <Input
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="ke Access Point Lantai 2"
          />
        </Field>

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Port"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function GeneratePortsModal({ deviceId, onClose, onSaved }) {
  const [form, setForm] = useState({
    namePrefix: "Gi0/",
    start: "1",
    end: "24",
    portMode: "ACCESS",
    vlan: "",
    description: "",
  });
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const fields = PORT_MODE_FIELDS[form.portMode];

  const start = Number(form.start);
  const end = Number(form.end);
  const count = Number.isInteger(start) && Number.isInteger(end) && end >= start ? end - start + 1 : 0;
  const preview = count > 0 ? `${form.namePrefix}${start} … ${form.namePrefix}${end}` : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (count < 1) return setError("Nomor akhir harus lebih besar atau sama dengan nomor awal");
    if (count > 200) return setError("Maksimal 200 port per pembuatan");
    if (fields.vlan && !form.vlan.trim()) {
      return setError(`Port ${PORT_MODE_LABELS[form.portMode]} wajib memiliki VLAN`);
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const data = await generatePorts(deviceId, {
        namePrefix: form.namePrefix,
        start,
        end,
        portMode: form.portMode,
        vlan: fields.vlan ? form.vlan.trim() : "",
        description: form.description.trim(),
      });
      setResult(data);
    } catch (err) {
      setError(apiError(err, "Gagal membuat port"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    const skipped = result.requested - result.created;
    return (
      <Modal title="Buat Rentang Port" onClose={onSaved}>
        <div className="space-y-4">
          <p className="text-sm text-ink">
            {result.created} port berhasil dibuat
            {skipped > 0 && `, ${skipped} dilewati karena nama interface-nya sudah ada`}.
          </p>
          <div className="flex justify-end">
            <Button onClick={onSaved}>Selesai</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Buat Rentang Port" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Awalan nama interface" hint="Contoh: Gi0/, Fa0/, atau Port ">
          <Input value={form.namePrefix} onChange={(e) => update("namePrefix", e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nomor awal">
            <Input type="number" min="0" value={form.start} onChange={(e) => update("start", e.target.value)} />
          </Field>
          <Field label="Nomor akhir">
            <Input type="number" min="0" value={form.end} onChange={(e) => update("end", e.target.value)} />
          </Field>
        </div>

        <ModeSelector value={form.portMode} onChange={(m) => update("portMode", m)} />

        {fields.vlan && (
          <Field label="VLAN" hint="Diterapkan ke semua port yang dibuat">
            <Input value={form.vlan} onChange={(e) => update("vlan", e.target.value)} placeholder="10" />
          </Field>
        )}

        <Field label="Keterangan (opsional)">
          <Input value={form.description} onChange={(e) => update("description", e.target.value)} />
        </Field>

        <p className="text-xs text-ink-faint">
          IP interface bersifat unik per port, jadi tidak diisi massal. Isi lewat tombol ubah pada tiap port.
        </p>

        {preview && (
          <p className="rounded border border-base-700 bg-base-900 px-3 py-2 text-xs text-ink-muted">
            Akan dibuat <span className="font-medium text-ink">{count}</span> port:{" "}
            <span className="font-mono">{preview}</span>
          </p>
        )}

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting || count < 1}>
            {isSubmitting ? "Membuat..." : "Buat Port"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
