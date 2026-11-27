import { Link } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { SearchBox, FilterSelect } from "../ui/FilterBar";
import { SortTh, SortControl } from "../ui/SortControls";
import StatusDot from "../ui/StatusDot";
import {
  DEVICE_TYPE_LABELS,
  ONLINE_STATUS_LABELS,
  durationSince,
  timeAgo,
} from "../../utils/format";

const STATUS_TABS = [
  { key: "", label: "Semua", countKey: "ALL" },
  { key: "ON", label: ONLINE_STATUS_LABELS.ON, countKey: "ON", dot: "bg-signal-up" },
  { key: "OFF", label: ONLINE_STATUS_LABELS.OFF, countKey: "OFF", dot: "bg-signal-down" },
  { key: "NEVER_ON", label: ONLINE_STATUS_LABELS.NEVER_ON, countKey: "NEVER_ON", dot: "bg-base-500" },
];

// Tab ringkasan status (Semua / On / Off / Never On) lengkap dengan jumlahnya, seperti di Ruijie Cloud.
export function StatusTabs({ value, counts, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter status">
      {STATUS_TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors ${
              active
                ? "border-accent bg-accent-dim text-ink"
                : "border-base-600 bg-base-800 text-ink-muted hover:border-base-500 hover:text-ink"
            }`}
          >
            {tab.dot && <span className={`h-2 w-2 rounded-full ${tab.dot}`} />}
            {tab.label}
            <span className="text-xs tabular-nums text-ink-faint">{counts?.[tab.countKey] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

// Pencarian mengikuti kolom yang tampil (Nama, SN, Model, IP, Area/Gedung; MAC untuk admin). Opsi "Jenis" dinamis: hanya jenis
// yang ada pada hasil saat ini (mengikuti pencarian, area, dan status), lengkap dengan jumlahnya.
export function DeviceSearchBar({ search, onSearchChange, onAddClick, canAdd, showMac, typeOptions = [], type = "", onTypeChange }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox
          value={search}
          onChange={onSearchChange}
          placeholder={showMac ? "Cari nama, SN, model, IP, MAC, area..." : "Cari nama, SN, model, IP, area..."}
          className="sm:max-w-md"
        />
        {onTypeChange && (
          <FilterSelect
            label="Semua jenis"
            value={type}
            onChange={onTypeChange}
            options={typeOptions}
            formatOption={(o) => DEVICE_TYPE_LABELS[o.value] ?? o.value}
          />
        )}
      </div>

      {canAdd && (
        <button
          onClick={onAddClick}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Perangkat
        </button>
      )}
    </div>
  );
}

function ActivityCell({ device }) {
  if (device.onlineStatus === "ON") {
    return <span className="text-ink-muted">Dicek {timeAgo(device.lastCheckedAt)}</span>;
  }
  if (device.onlineStatus === "OFF") {
    return (
      <span className="text-signal-down" title={`Terakhir On: ${device.lastOnlineAt ? timeAgo(device.lastOnlineAt) : "-"}`}>
        Off {durationSince(device.offlineSince)}
      </span>
    );
  }
  return <span className="text-ink-faint">Belum pernah aktif</span>;
}

const DEVICE_SORT_COLUMNS = [
  { key: "status", label: "Status" },
  { key: "name", label: "Nama" },
  { key: "serialNumber", label: "SN" },
  { key: "model", label: "Model" },
  { key: "ipAddress", label: "IP Manajemen" },
  { key: "macAddress", label: "MAC", adminOnly: true },
  { key: "building", label: "Area/Gedung" },
];

export function DeviceTable({ devices, showAdminColumns, selectedIds, onToggle, onToggleAll, sort, onSort, onSortChange }) {
  if (devices.length === 0) {
    return (
      <div className="rounded-md border border-base-700 bg-base-800 py-16 text-center">
        <p className="text-sm font-medium text-ink">Tidak ada perangkat ditemukan</p>
        <p className="mt-1 text-sm text-ink-muted">Coba ubah kata kunci pencarian, status, atau area.</p>
      </div>
    );
  }

  const selectable = Boolean(onToggle);
  const allSelected = selectable && devices.every((d) => selectedIds.has(d.id));
  const th = "whitespace-nowrap px-3 py-2.5 font-medium";

  return (
    <>
    {onSortChange && (
      <SortControl
        columns={DEVICE_SORT_COLUMNS.filter((c) => !c.adminOnly || showAdminColumns)}
        sort={sort}
        onChange={onSortChange}
        className="mb-2"
      />
    )}
    {/* HP: kartu bertumpuk (tanpa scroll samping) */}
    <ul className="space-y-2 md:hidden">
      {devices.map((device) => (
        <li
          key={device.id}
          className={`rounded-md border bg-base-800 p-3 ${selectedIds?.has(device.id) ? "border-accent/60 bg-accent-dim/40" : "border-base-700"}`}
        >
          <div className="flex items-start gap-3">
            {selectable && (
              <input
                type="checkbox"
                aria-label={`Pilih ${device.name}`}
                checked={selectedIds.has(device.id)}
                onChange={() => onToggle(device.id)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#5B8DEF]"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/devices/${device.id}`} className="min-w-0 break-words font-medium text-ink hover:text-accent">
                  {device.name}
                </Link>
                <StatusDot status={device.onlineStatus} />
              </div>
              <p className="text-xs text-ink-faint">
                {DEVICE_TYPE_LABELS[device.type]}
                {device.model ? ` · ${device.model}` : device.vendor ? ` · ${device.vendor}` : ""}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="min-w-0">
                  <dt className="text-ink-faint">IP</dt>
                  <dd className="truncate font-mono text-ink-muted">{device.ipAddress || "-"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-ink-faint">SN</dt>
                  <dd className="truncate font-mono text-ink-muted">{device.serialNumber || "-"}</dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-ink-faint">Area</dt>
                  <dd className="truncate text-ink-muted">
                    {device.building?.name || "Tanpa area"}
                    {device.location ? ` · ${device.location}` : ""}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs">
                <ActivityCell device={device} />
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>

    <div className="hidden overflow-x-auto rounded-md border border-base-700 bg-base-800 md:block">
      <table className="w-full min-w-[780px] text-sm">
        <thead>
          <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
            {selectable && (
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Pilih semua di halaman ini"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-3.5 w-3.5 accent-[#5B8DEF]"
                />
              </th>
            )}
            <SortTh label="Status" sortKey="status" sort={sort} onSort={onSort} className={th} />
            <SortTh label="Nama" sortKey="name" sort={sort} onSort={onSort} className={th} />
            <SortTh label="SN" sortKey="serialNumber" sort={sort} onSort={onSort} className={th} />
            <SortTh label="Model" sortKey="model" sort={sort} onSort={onSort} className={th} />
            <SortTh label="IP Manajemen" sortKey="ipAddress" sort={sort} onSort={onSort} className={th} />
            {showAdminColumns && <SortTh label="MAC" sortKey="macAddress" sort={sort} onSort={onSort} className={`${th} hidden 2xl:table-cell`} />}
            <SortTh label="Area/Gedung" sortKey="building" sort={sort} onSort={onSort} className={th} />
            <th className={`${th} hidden 2xl:table-cell`}>Aktivitas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-base-700">
          {devices.map((device) => (
            <tr
              key={device.id}
              className={`transition-colors hover:bg-base-700/30 ${selectedIds?.has(device.id) ? "bg-accent-dim/40" : ""}`}
            >
              {selectable && (
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Pilih ${device.name}`}
                    checked={selectedIds.has(device.id)}
                    onChange={() => onToggle(device.id)}
                    className="h-3.5 w-3.5 accent-[#5B8DEF]"
                  />
                </td>
              )}
              <td className="whitespace-nowrap px-3 py-2.5">
                <StatusDot status={device.onlineStatus} />
                {/* < 2xl: kolom Aktivitas disembunyikan, infonya dipindah ke bawah status */}
                <p className="mt-0.5 text-xs 2xl:hidden">
                  <ActivityCell device={device} />
                </p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <Link to={`/devices/${device.id}`} className="font-medium text-ink hover:text-accent">
                  {device.name}
                </Link>
                <p className="text-xs text-ink-faint">{DEVICE_TYPE_LABELS[device.type]}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">{device.serialNumber || "-"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                {device.model ? (
                  <>
                    {device.model}
                    {device.vendor && <p className="text-xs text-ink-faint">{device.vendor}</p>}
                  </>
                ) : (
                  device.vendor || "-"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">{device.ipAddress || "-"}</td>
              {showAdminColumns && (
                <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted 2xl:table-cell">{device.macAddress || "-"}</td>
              )}
              <td className="px-3 py-2.5 text-ink-muted">
                {device.building?.name || <span className="text-ink-faint">Tanpa area</span>}
                {device.location && <p className="text-xs text-ink-faint">{device.location}</p>}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs 2xl:table-cell">
                <ActivityCell device={device} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function Pagination({ page, pageSize, total, onChange, unit = "perangkat" }) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.ceil(total / pageSize);
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded border border-base-600 text-ink-muted transition-colors hover:border-base-500 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center justify-between text-xs text-ink-faint">
      <span>
        {from}–{to} dari {total} {unit}
      </span>
      <div className="flex items-center gap-2">
        <button className={btn} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tabular-nums">
          {page} / {lastPage}
        </span>
        <button className={btn} onClick={() => onChange(page + 1)} disabled={page >= lastPage} aria-label="Halaman berikutnya">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
