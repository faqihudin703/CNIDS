import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Badge from "../components/ui/Badge";
import PoolHint from "../components/ui/PoolHint";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import { useFetch } from "../hooks/useFetch";
import { useTableFilter } from "../hooks/useTableFilter";
import { SearchBox, FilterSelect, FilterSummary } from "../components/ui/FilterBar";
import { useSort } from "../hooks/useSort";
import { sortRows, ipSortKey, prefixNumber } from "../utils/sort";
import { SortTh, SortControl } from "../components/ui/SortControls";
import { listIpEntries, listPools } from "../api/ipam";
import { PORT_MODE_LABELS, PORT_MODE_BADGE } from "../utils/format";

// IPAM: dua sudut pandang atas data port yang sama.
//  - Daftar IP : setiap alamat IP yang tercatat, lintas perangkat.
//  - IP Pool   : pool unik (network + prefix) beserta pemakaiannya. Pool yang sama dipakai bersama,
//                tidak menumpuk walau banyak port berada di dalamnya.
// Read-only; perubahan data lewat tab Port pada masing-masing perangkat.
const ENTRY_SORT = {
  ip: (e) => ipSortKey(e.ipInterface),
  prefix: (e) => prefixNumber(e.prefix),
  device: (e) => e.device?.name,
  port: (e) => e.interfaceName,
  pool: (e) => (e.pool ? ipSortKey(e.pool.cidr.split("/")[0]) : null),
  vlan: (e) => e.vlan,
  mode: (e) => PORT_MODE_LABELS[e.portMode] ?? e.portMode,
  description: (e) => e.description,
};
const ENTRY_COLUMNS = [
  { key: "ip", label: "IP" }, { key: "prefix", label: "Prefix" }, { key: "device", label: "Perangkat" },
  { key: "port", label: "Port" }, { key: "pool", label: "IP Pool" }, { key: "vlan", label: "VLAN" },
  { key: "mode", label: "Mode" }, { key: "description", label: "Keterangan" },
];
const POOL_SORT = {
  cidr: (p) => ipSortKey(p.cidr.split("/")[0]),
  range: (p) => ipSortKey(String(p.range).split(/\s*[-–]\s*/)[0]),
  hosts: (p) => p.hosts,
  used: (p) => p.utilization,
  vlan: (p) => (p.vlans || []).join(", "),
  devices: (p) => (p.devices || []).map((d) => d.name).join(", "),
};
const POOL_COLUMNS = [
  { key: "cidr", label: "Pool" }, { key: "range", label: "Rentang host" }, { key: "hosts", label: "Kapasitas" },
  { key: "used", label: "Terpakai" }, { key: "vlan", label: "VLAN" }, { key: "devices", label: "Perangkat" },
];

// Pencarian memakai teks kolom yang tampil; opsi filter dibangun dari baris yang sedang tampil (lengkap dengan jumlahnya).
const ENTRY_SEARCH = [
  (e) => e.ipInterface, (e) => e.prefix, (e) => e.device?.name, (e) => e.interfaceName,
  (e) => e.pool?.cidr, (e) => e.pool?.range, (e) => e.vlan, (e) => PORT_MODE_LABELS[e.portMode], (e) => e.description,
];
const ENTRY_FILTERS = { vlan: (e) => e.vlan, mode: (e) => e.portMode, pool: (e) => e.pool?.cidr };
const ENTRY_LABELS = { vlan: (v) => `VLAN ${v}`, mode: (v) => PORT_MODE_LABELS[v] ?? v };
const POOL_SEARCH = [
  (p) => p.cidr, (p) => p.range, (p) => p.hosts, (p) => `${p.used} IP`, (p) => (p.vlans || []).join(" "), (p) => (p.devices || []).map((d) => d.name).join(" "),
];
const POOL_FILTERS = { vlan: (p) => p.vlans || [], device: (p) => (p.devices || []).map((d) => d.name) };
const POOL_LABELS = { vlan: (v) => `VLAN ${v}` };

export default function IpamPage() {
  const [tab, setTab] = useState("ips");

  const { sort, toggle, setSort } = useSort();
  // Dimuat sekali; pencarian & filter berjalan langsung di layar tanpa memanggil server tiap ketikan.
  const fetchEntries = useMemo(() => () => listIpEntries({}), []);
  const { data, error, isLoading, refetch } = useFetch(fetchEntries, []);
  const { data: poolData, error: poolError, isLoading: poolsLoading, refetch: refetchPools } = useFetch(listPools, []);
  const entries = data?.data ?? [];
  const pools = poolData?.data ?? [];
  const ef = useTableFilter(entries, { searchAccessors: ENTRY_SEARCH, filters: ENTRY_FILTERS, labels: ENTRY_LABELS });
  const pf = useTableFilter(pools, { searchAccessors: POOL_SEARCH, filters: POOL_FILTERS, labels: POOL_LABELS });

  function openPool(pool) {
    ef.reset();
    ef.setValue("pool", pool.cidr);
    setTab("ips");
  }

  return (
    <AppShell
      title="Alamat IP (IPAM)"
      description="Daftar agregat seluruh alamat IP yang tercatat pada port perangkat"
    >
      <div className="space-y-4">
        <div className="flex gap-1 border-b border-base-700" role="tablist">
          {[
            { key: "ips", label: "Daftar IP", count: data ? entries.length : undefined },
            { key: "pools", label: "IP Pool", count: poolData ? pools.length : undefined },
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.count != null && <span className="ml-2 text-xs tabular-nums text-ink-faint">{t.count}</span>}
            </button>
          ))}
        </div>

        {tab === "ips" ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchBox value={ef.query} onChange={ef.setQuery} placeholder="Cari IP, prefix, perangkat, port, pool, VLAN..." />
              <FilterSelect label="Semua VLAN" value={ef.values.vlan ?? ""} onChange={(v) => ef.setValue("vlan", v)} options={ef.options("vlan")} formatOption={(o) => `VLAN ${o.value}`} />
              <FilterSelect label="Semua mode" value={ef.values.mode ?? ""} onChange={(v) => ef.setValue("mode", v)} options={ef.options("mode")} />
              <FilterSelect label="Semua pool" value={ef.values.pool ?? ""} onChange={(v) => ef.setValue("pool", v)} options={ef.options("pool")} />
            </div>
            {!isLoading && !error && <FilterSummary shown={ef.filtered.length} total={entries.length} active={ef.active} onReset={ef.reset} unit="IP" />}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchBox value={pf.query} onChange={pf.setQuery} placeholder="Cari pool, rentang, VLAN, perangkat..." />
              <FilterSelect label="Semua VLAN" value={pf.values.vlan ?? ""} onChange={(v) => pf.setValue("vlan", v)} options={pf.options("vlan")} formatOption={(o) => `VLAN ${o.value}`} />
              <FilterSelect label="Semua perangkat" value={pf.values.device ?? ""} onChange={(v) => pf.setValue("device", v)} options={pf.options("device")} />
            </div>
            {!poolsLoading && !poolError && <FilterSummary shown={pf.filtered.length} total={pools.length} active={pf.active} onReset={pf.reset} unit="pool" />}
          </>
        )}

        {tab === "pools" ? (
          <PoolsTable rows={pf.filtered} total={pools.length} error={poolError} isLoading={poolsLoading} refetch={refetchPools} onOpen={openPool} />
        ) : isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Belum ada IP tercatat"
            description="Alamat IP dicatat lewat tab Port pada masing-masing perangkat."
          />
        ) : ef.filtered.length === 0 ? (
          <EmptyState title="Tidak ada IP yang cocok" description="Ubah kata kunci atau reset filter." />
        ) : (
          <>
          <SortControl columns={ENTRY_COLUMNS} sort={sort} onChange={setSort} className="mb-3" />
          <div className="overflow-x-auto rounded-md border border-base-700 bg-base-800">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <SortTh label="IP" sortKey="ip" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Prefix" sortKey="prefix" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Perangkat" sortKey="device" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Port" sortKey="port" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="IP Pool" sortKey="pool" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="VLAN" sortKey="vlan" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Mode" sortKey="mode" sort={sort} onSort={toggle} className="whitespace-nowrap px-3 py-2.5 font-medium" />
                  <SortTh label="Keterangan" sortKey="description" sort={sort} onSort={toggle} className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700">
                {sortRows(ef.filtered, sort, ENTRY_SORT).map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-base-700/30">
                    <td data-label="IP" className="whitespace-nowrap px-3 py-2 font-mono text-ink">{entry.ipInterface}</td>
                    <td data-label="Prefix" className="whitespace-nowrap px-3 py-2 text-ink-muted">
                      {entry.prefix ? <PoolHint pool={entry.pool}>{entry.prefix}</PoolHint> : "-"}
                    </td>
                    <td data-label="Perangkat" className="whitespace-nowrap px-3 py-2">
                      <Link to={`/devices/${entry.device.id}`} className="text-ink hover:text-accent">
                        {entry.device.name}
                      </Link>
                    </td>
                    <td data-label="Port" className="whitespace-nowrap px-3 py-2 font-mono text-ink-muted">{entry.interfaceName}</td>
                    <td data-label="IP Pool" className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-muted">
                      {entry.pool ? (
                        <button
                          onClick={() => ef.setValue("pool", entry.pool.cidr)}
                          className="text-left hover:text-accent"
                          title="Tampilkan semua IP di pool ini"
                        >
                          <span className="block text-ink">{entry.pool.cidr}</span>
                          <span className="block text-ink-faint">{entry.pool.range}</span>
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td data-label="VLAN" className="whitespace-nowrap px-3 py-2 text-ink-muted">{entry.vlan || "-"}</td>
                    <td data-label="Mode" className="whitespace-nowrap px-3 py-2">
                      <Badge variant={PORT_MODE_BADGE[entry.portMode]}>{PORT_MODE_LABELS[entry.portMode]}</Badge>
                    </td>
                    <td data-label="Keterangan" className="px-3 py-2 text-ink-muted">{entry.description || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function PoolsTable({ rows, total, error, isLoading, refetch, onOpen }) {
  const { sort, toggle, setSort } = useSort();
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (total === 0) {
    return (
      <EmptyState
        title="Belum ada IP pool"
        description="Pool terbentuk otomatis begitu sebuah port diberi IP interface dan prefix."
      />
    );
  }
  if (rows.length === 0) return <EmptyState title="Tidak ada pool yang cocok" description="Ubah kata kunci atau reset filter." />;

  const th = "whitespace-nowrap px-3 py-2.5 font-medium";
  return (
    <>
    <SortControl columns={POOL_COLUMNS} sort={sort} onChange={setSort} className="mb-3" />
    <div className="overflow-x-auto rounded-md border border-base-700 bg-base-800">
      <table className="table-stack w-full text-sm">
        <thead>
          <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
            <SortTh label="Pool" sortKey="cidr" sort={sort} onSort={toggle} className={th} />
            <SortTh label="Rentang host" sortKey="range" sort={sort} onSort={toggle} className={th} />
            <SortTh label="Kapasitas" sortKey="hosts" sort={sort} onSort={toggle} className={th} />
            <SortTh label="Terpakai" sortKey="used" sort={sort} onSort={toggle} className={th} />
            <SortTh label="VLAN" sortKey="vlan" sort={sort} onSort={toggle} className={th} />
            <SortTh label="Perangkat" sortKey="devices" sort={sort} onSort={toggle} className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-base-700">
          {sortRows(rows, sort, POOL_SORT).map((pool) => {
            const pct = Math.round(pool.utilization * 100);
            return (
              <tr key={pool.id} className="transition-colors hover:bg-base-700/30">
                <td data-label="Pool" className="whitespace-nowrap px-3 py-2.5">
                  <button
                    onClick={() => onOpen(pool)}
                    className="font-mono text-ink hover:text-accent"
                    title="Lihat IP di pool ini"
                  >
                    {pool.cidr}
                  </button>
                </td>
                <td data-label="Rentang host" className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">{pool.range}</td>
                <td data-label="Kapasitas" className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-muted">
                  {pool.hosts.toLocaleString("id-ID")}
                </td>
                <td data-label="Terpakai" className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-base-700">
                      <div
                        className={pct >= 90 ? "h-full bg-signal-down" : pct >= 70 ? "h-full bg-signal-warn" : "h-full bg-accent"}
                        style={{ width: `${Math.max(pool.used > 0 ? 3 : 0, pct)}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
                      {pool.used} IP · {pool.utilization > 0 && pct === 0 ? "<1" : pct}%
                    </span>
                  </div>
                </td>
                <td data-label="VLAN" className="px-3 py-2.5">
                  {pool.vlans.length === 0 ? (
                    <span className="text-ink-faint">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {pool.vlans.map((v) => (
                        <Badge key={v}>VLAN {v}</Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td data-label="Perangkat" className="px-3 py-2.5 text-ink-muted">
                  {pool.devices.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ", "}
                      <Link to={`/devices/${d.id}`} className="hover:text-accent">
                        {d.name}
                      </Link>
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
