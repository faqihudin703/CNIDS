import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight, Folder, FolderOpen, Pencil, Trash2, FolderPlus } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Field, Input, Select } from "../components/ui/FormControls";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { listBuildings, createBuilding, updateBuilding, deleteBuilding } from "../api/buildings";
import { useSort } from "../hooks/useSort";
import { sortRows } from "../utils/sort";
import { matchesQuery } from "../utils/filter";
import { SearchBox, FilterSummary } from "../components/ui/FilterBar";
import { SortTh, SortControl } from "../components/ui/SortControls";
import { buildAreaTree, flattenAreaTree, ONLINE_STATUS_LABELS } from "../utils/format";

// Area/Gedung berbentuk pohon (area > gedung > lantai/ruang), mirip Device Group di Ruijie Cloud.
// Jumlah perangkat di tiap baris sudah menjumlahkan seluruh sub-area di bawahnya.
const AREA_SORT = {
  name: (n) => n.name,
  code: (n) => n.code,
  deviceTotal: (n) => n.deviceTotal,
  description: (n) => n.description,
};
const AREA_SORT_COLUMNS = [
  { key: "name", label: "Nama" },
  { key: "code", label: "Kode" },
  { key: "deviceTotal", label: "Perangkat" },
  { key: "description", label: "Deskripsi" },
];

// Kolom yang tampil: Nama, Kode, Perangkat, Deskripsi. Cabang dipertahankan bila dirinya atau salah satu turunannya cocok.
const AREA_SEARCH = [(n) => n.name, (n) => n.code, (n) => n.deviceTotal, (n) => n.description];
function filterTree(nodes, query) {
  const out = [];
  for (const n of nodes) {
    const kids = filterTree(n.children, query);
    if (kids.length > 0 || matchesQuery(n, query, AREA_SEARCH)) out.push({ ...n, children: kids.length > 0 || !matchesQuery(n, query, AREA_SEARCH) ? kids : n.children });
  }
  return out;
}
const countNodes = (nodes) => nodes.reduce((a, n) => a + 1 + countNodes(n.children), 0);

// Urutkan tiap tingkat saudara (hirarki tetap utuh).
function sortTree(nodes, sort) {
  return sortRows(nodes, sort, AREA_SORT).map((n) => ({ ...n, children: sortTree(n.children, sort) }));
}

export default function BuildingsPage() {
  const { isAdmin } = useAuth();
  const { data, error, isLoading, refetch } = useFetch(listBuildings, []);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [formState, setFormState] = useState(null); // { area?: node, parentId?: number|"" }
  const [deletingId, setDeletingId] = useState(null);

  const tree = useMemo(() => buildAreaTree(data?.data || []), [data]);
  const { sort, toggle: toggleSort, setSort } = useSort();
  const sortedTree = useMemo(() => (sort ? sortTree(tree, sort) : tree), [tree, sort]);
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  // Saat mencari, hasil ditampilkan terbuka penuh (ancestor tetap tampil supaya konteks lokasi jelas).
  const shownTree = useMemo(() => (searching ? filterTree(sortedTree, query) : sortedTree), [sortedTree, query, searching]);
  const showUnassigned = !searching || matchesQuery({ name: "Tanpa area", deviceTotal: unassignedTotal }, query, AREA_SEARCH);
  const rows = useMemo(() => flattenVisible(shownTree, searching ? new Set() : collapsed), [shownTree, collapsed, searching]);
  const unassigned = data?.unassigned;
  const unassignedTotal = unassigned ? unassigned.ON + unassigned.OFF + unassigned.NEVER_ON : 0;

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave(payload, existing) {
    if (existing) await updateBuilding(existing.id, payload);
    else await createBuilding(payload);
    setFormState(null);
    refetch();
  }

  async function handleDelete(node) {
    const lines = [];
    const direct = node.statusCounts.ON + node.statusCounts.OFF + node.statusCounts.NEVER_ON;
    lines.push(
      direct > 0
        ? `${direct} perangkat di area ini tidak ikut terhapus, tetapi akan menjadi "Tanpa area".`
        : "Belum ada perangkat langsung di area ini."
    );
    if (node.children.length > 0) {
      lines.push(`${node.children.length} sub-area akan naik ke tingkat teratas.`);
    }
    if (!window.confirm(`Hapus "${node.name}"?\n\n${lines.join("\n")}`)) return;

    setDeletingId(node.id);
    try {
      await deleteBuilding(node.id);
      refetch();
    } catch (err) {
      window.alert(err.response?.data?.error || "Gagal menghapus area/gedung");
    } finally {
      setDeletingId(null);
    }
  }

  const th = "whitespace-nowrap px-3 py-2.5 font-medium";

  return (
    <AppShell
      title="Area/Gedung"
      description="Struktur lokasi fisik yang menaungi perangkat jaringan"
      action={
        isAdmin && (
          <Button size="sm" onClick={() => setFormState({ parentId: "" })}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tambah Area</span>
            <span className="sm:hidden">Tambah</span>
          </Button>
        )
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : tree.length === 0 && unassignedTotal === 0 ? (
        <EmptyState
          title="Belum ada area/gedung terdaftar"
          description="Tambahkan area atau gedung untuk mulai mengelompokkan perangkat berdasarkan lokasi."
        />
      ) : (
        <>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Cari nama, kode, jumlah perangkat, deskripsi..." />
          <FilterSummary shown={countNodes(shownTree)} total={countNodes(tree)} active={searching} onReset={() => setQuery("")} unit="area" />
        </div>
        <SortControl columns={AREA_SORT_COLUMNS} sort={sort} onChange={setSort} className="mb-3" />
        <div className="overflow-x-auto rounded-md border border-base-700 bg-base-800">
          <table className="table-stack w-full text-sm">
            <thead>
              <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
                <SortTh label="Nama" sortKey="name" sort={sort} onSort={toggleSort} className={th} />
                <SortTh label="Kode" sortKey="code" sort={sort} onSort={toggleSort} className={th} />
                <SortTh label="Perangkat" sortKey="deviceTotal" sort={sort} onSort={toggleSort} className={th} />
                <th className={th}>Status</th>
                <SortTh label="Deskripsi" sortKey="description" sort={sort} onSort={toggleSort} className={th} />
                {isAdmin && <th className={`${th} text-right`}>Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-700">
              {rows.map((node) => {
                const hasChildren = node.children.length > 0;
                const open = hasChildren && !collapsed.has(node.id);
                return (
                  <tr key={node.id} className="transition-colors hover:bg-base-700/30">
                    <td data-label="Nama" className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5" style={{ paddingLeft: node.depth * 20 }}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggle(node.id)}
                            aria-label={open ? "Ciutkan" : "Bentangkan"}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-base-700 hover:text-ink"
                          >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
                          </button>
                        ) : (
                          <span className="h-5 w-5 shrink-0" />
                        )}
                        {open ? (
                          <FolderOpen className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
                        ) : (
                          <Folder className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
                        )}
                        <Link to={`/devices?area=${node.id}`} className="font-medium text-ink hover:text-accent">
                          {node.name}
                        </Link>
                        {hasChildren && <span className="text-xs text-ink-faint">{node.children.length} sub-area</span>}
                      </div>
                    </td>
                    <td data-label="Kode" className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">{node.code || "-"}</td>
                    <td data-label="Perangkat" className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink">{node.deviceTotal}</td>
                    <td data-label="Status" className="px-3 py-2.5">
                      <StatusSummary counts={node.statusTotals} />
                    </td>
                    <td data-label="Deskripsi" className="px-3 py-2.5 text-ink-muted">{node.description || "-"}</td>
                    {isAdmin && (
                      <td data-label="Aksi" className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex justify-end gap-0.5">
                          <IconButton title="Tambah sub-area" onClick={() => setFormState({ parentId: node.id })}>
                            <FolderPlus className="h-4 w-4" />
                          </IconButton>
                          <IconButton title="Ubah" onClick={() => setFormState({ area: node })}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            title="Hapus"
                            danger
                            disabled={deletingId === node.id}
                            onClick={() => handleDelete(node)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {unassignedTotal > 0 && showUnassigned && (
                <tr className="bg-base-900/40">
                  <td data-label="Nama" className="px-3 py-2.5 text-ink-muted">
                    <div className="flex items-center gap-1.5 pl-[26px]">
                      <Folder className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                      <Link to="/devices?area=none" className="hover:text-accent">
                        Tanpa area
                      </Link>
                    </div>
                  </td>
                  <td data-label="Kode" className="px-3 py-2.5 text-ink-faint">-</td>
                  <td data-label="Perangkat" className="px-3 py-2.5 tabular-nums text-ink">{unassignedTotal}</td>
                  <td data-label="Status" className="px-3 py-2.5">
                    <StatusSummary counts={unassigned} />
                  </td>
                  <td data-label="Deskripsi" className="px-3 py-2.5 text-ink-faint">Perangkat yang belum dimasukkan ke area</td>
                  {isAdmin && <td data-label="Aksi" />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {searching && rows.length === 0 && !(unassignedTotal > 0 && showUnassigned) && (
          <p className="py-6 text-center text-sm text-ink-muted">Tidak ada area yang cocok dengan pencarian.</p>
        )}
        </>
      )}

      {formState && (
        <AreaFormModal
          tree={tree}
          area={formState.area}
          defaultParentId={formState.parentId}
          onClose={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}
    </AppShell>
  );
}

function flattenVisible(nodes, collapsed, out = []) {
  for (const n of nodes) {
    out.push(n);
    if (!collapsed.has(n.id)) flattenVisible(n.children, collapsed, out);
  }
  return out;
}

function StatusSummary({ counts }) {
  const items = [
    { key: "ON", dot: "bg-signal-up", text: "text-signal-up" },
    { key: "OFF", dot: "bg-signal-down", text: "text-signal-down" },
    { key: "NEVER_ON", dot: "bg-base-500", text: "text-ink-muted" },
  ];
  const total = counts.ON + counts.OFF + counts.NEVER_ON;
  if (total === 0) return <span className="text-ink-faint">-</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items
        .filter((i) => counts[i.key] > 0)
        .map((i) => (
          <span key={i.key} className="inline-flex items-center gap-1.5 text-xs" title={ONLINE_STATUS_LABELS[i.key]}>
            <span className={`h-2 w-2 rounded-full ${i.dot}`} />
            <span className={`tabular-nums ${i.text}`}>{counts[i.key]}</span>
            <span className="text-ink-faint">{ONLINE_STATUS_LABELS[i.key]}</span>
          </span>
        ))}
    </div>
  );
}

function IconButton({ title, danger, children, ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`rounded p-1.5 text-ink-faint transition-colors hover:bg-base-700 disabled:opacity-40 ${
        danger ? "hover:text-signal-down" : "hover:text-ink"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

function AreaFormModal({ tree, area, defaultParentId, onClose, onSubmit }) {
  const [name, setName] = useState(area?.name || "");
  const [code, setCode] = useState(area?.code || "");
  const [description, setDescription] = useState(area?.description || "");
  const [parentId, setParentId] = useState(area ? (area.parentId ?? "") : (defaultParentId ?? ""));
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Saat mengubah, area ini (dan turunannya) tidak boleh dipilih sebagai induk.
  const parentOptions = useMemo(() => flattenAreaTree(tree, area?.id ?? null), [tree, area]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama area/gedung wajib diisi");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        {
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          parentId: parentId === "" ? null : Number(parentId),
        },
        area
      );
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan area/gedung");
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={area ? "Ubah Area/Gedung" : "Tambah Area/Gedung"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama area/gedung">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </Field>
        <Field label="Berada di dalam" hint="Kosongkan untuk area tingkat teratas">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Tingkat teratas —</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kode singkat (opsional)" hint="Contoh: FT, FEBI, UPPTIK. Harus unik">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Deskripsi (opsional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
