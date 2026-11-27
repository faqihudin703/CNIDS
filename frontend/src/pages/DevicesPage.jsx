import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/FormControls";
import { LoadingState, ErrorState } from "../components/ui/States";
import { DeviceSearchBar, DeviceTable, StatusTabs, Pagination } from "../components/devices/DeviceList";
import { useSort } from "../hooks/useSort";
import { useDebounced } from "../hooks/useDebounced";
import AreaTree from "../components/devices/AreaTree";
import DeviceForm from "../components/devices/DeviceForm";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { listDevices, createDevice, bulkMoveDevices } from "../api/devices";
import { listBuildings } from "../api/buildings";
import { buildAreaTree, flattenAreaTree } from "../utils/format";

const PAGE_SIZE = 25;

export default function DevicesPage() {
  const { isAdmin } = useAuth();
  const [params] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [type, setType] = useState("");
  const [area, setArea] = useState(params.get("area") || ""); // "" semua | "none" tanpa area | id
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { sort, toggle: toggleSort, setSort } = useSort(); // diurutkan di server (seluruh data, bukan hanya halaman ini)
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState(null);

  // Pencarian ke server ditunda sebentar (250 ms) dan data lama tetap tampil selama memuat, jadi terasa langsung.
  const search = useDebounced(searchInput.trim(), 250);

  // Ganti filter -> kembali ke halaman 1 dan kosongkan pilihan.
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, area, status, type, sort]);

  const fetchDevices = useMemo(
    () => () =>
      listDevices({
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
        buildingId: area && area !== "none" ? area : undefined,
        unassigned: area === "none" ? true : undefined,
        sort: sort?.key,
        order: sort?.dir,
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, status, type, area, page, sort]
  );
  const { data, error, isLoading, refetch } = useFetch(fetchDevices, [search, status, type, area, page, sort], { keepPrevious: true, pollMs: 5000 }); // status On/Off hasil ping ikut berubah tanpa refresh
  // Jenis terpilih tetap muncul di dropdown walau hasil pencarian saat ini tidak memuatnya (jumlah 0), agar filter tidak "tersembunyi".
  const typeOptions = useMemo(() => {
    const opts = data?.facets?.types ?? [];
    return type && !opts.some((o) => o.value === type) ? [{ value: type, count: 0 }, ...opts] : opts;
  }, [data, type]);
  const { data: areaData, refetch: refetchAreas } = useFetch(listBuildings, []);

  const tree = useMemo(() => buildAreaTree(areaData?.data || []), [areaData]);
  const flatAreas = useMemo(() => flattenAreaTree(tree), [tree]);
  const totalCount = useMemo(
    () => tree.reduce((n, r) => n + r.deviceTotal, 0) + sumStatus(areaData?.unassigned),
    [tree, areaData]
  );

  async function handleCreate(payload) {
    await createDevice(payload);
    setShowAddModal(false);
    refetch();
    refetchAreas();
  }

  const devices = data?.data || [];

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const everyOn = devices.length > 0 && devices.every((d) => prev.has(d.id));
      const next = new Set(prev);
      devices.forEach((d) => (everyOn ? next.delete(d.id) : next.add(d.id)));
      return next;
    });
  }

  async function handleMove() {
    setMoveError(null);
    setIsMoving(true);
    try {
      await bulkMoveDevices([...selectedIds], moveTarget === "" ? null : Number(moveTarget));
      setSelectedIds(new Set());
      setMoveTarget("");
      refetch();
      refetchAreas();
    } catch (err) {
      setMoveError(err.response?.data?.error || "Gagal memindahkan perangkat");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <AppShell title="Perangkat" description="Daftar perangkat jaringan yang terdokumentasi">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-60">
          <div className="lg:hidden">
            <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter area/gedung">
              <option value="">Semua area/gedung</option>
              {flatAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
              <option value="none">Tanpa area</option>
            </Select>
          </div>
          <div className="hidden lg:block">
            <AreaTree
              tree={tree}
              totalCount={totalCount}
              unassignedCount={sumStatus(areaData?.unassigned)}
              selected={area}
              onSelect={setArea}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <StatusTabs value={status} counts={data?.counts} onChange={setStatus} />

          <DeviceSearchBar
            search={searchInput}
            onSearchChange={setSearchInput}
            showMac={isAdmin}
            type={type}
            typeOptions={typeOptions}
            onTypeChange={setType}
            canAdd={isAdmin}
            onAddClick={() => setShowAddModal(true)}
          />

          {isAdmin && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-accent-dim/50 px-4 py-2.5">
              <span className="text-sm text-ink">{selectedIds.size} perangkat dipilih</span>
              <div className="w-56">
                <Select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} aria-label="Pindahkan ke area">
                  <option value="">Tanpa area</option>
                  {flatAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button size="sm" onClick={handleMove} disabled={isMoving}>
                {isMoving ? "Memindahkan..." : "Pindahkan ke area"}
              </Button>
              <button className="text-sm text-ink-muted hover:text-ink" onClick={() => setSelectedIds(new Set())}>
                Batal pilih
              </button>
              {moveError && <span className="text-sm text-signal-down">{moveError}</span>}
            </div>
          )}

          {isLoading && !data ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <>
              <DeviceTable
                devices={devices}
                sort={sort}
                onSort={toggleSort}
                onSortChange={setSort}
                showAdminColumns={isAdmin}
                selectedIds={isAdmin ? selectedIds : undefined}
                onToggle={isAdmin ? toggleOne : undefined}
                onToggleAll={isAdmin ? toggleAll : undefined}
              />
              <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      {showAddModal && (
        <Modal title="Tambah Perangkat" width="max-w-2xl" onClose={() => setShowAddModal(false)}>
          <DeviceForm
            areas={flatAreas}
            initialValues={{ buildingId: area && area !== "none" ? area : "" }}
            onSubmit={handleCreate}
            onCancel={() => setShowAddModal(false)}
            submitLabel="Tambah Perangkat"
          />
        </Modal>
      )}
    </AppShell>
  );
}

function sumStatus(counts) {
  return counts ? counts.ON + counts.OFF + counts.NEVER_ON : 0;
}
