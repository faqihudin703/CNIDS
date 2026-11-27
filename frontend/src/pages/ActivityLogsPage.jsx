import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import { useFetch } from "../hooks/useFetch";
import { useSort } from "../hooks/useSort";
import { useDebounced } from "../hooks/useDebounced";
import { SearchBox } from "../components/ui/FilterBar";
import { SortTh, SortControl } from "../components/ui/SortControls";
import { listActivityLogs } from "../api/activityLogs";
import { formatDate } from "../utils/format";

const PAGE_SIZE = 50;
const LOG_SORT_COLUMNS = [
  { key: "loggedAt", label: "Waktu" },
  { key: "user", label: "Pengguna" },
  { key: "action", label: "Aksi" },
];

export default function ActivityLogsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 250);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search]);
  const { sort, toggle, setSort } = useSort(); // diurutkan di server
  const changeSort = (v) => { setPage(1); setSort(v); };
  const toggleSort = (k) => { setPage(1); toggle(k); };

  const fetchLogs = useMemo(() => () => listActivityLogs({ page, pageSize: PAGE_SIZE, sort: sort?.key, order: sort?.dir, search: search || undefined }), [page, sort, search]);
  const { data, error, isLoading, refetch } = useFetch(fetchLogs, [page, sort, search], { keepPrevious: true });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AppShell title="Log Aktivitas" description="Riwayat aksi seluruh pengguna untuk keperluan audit">
      <div className="space-y-4">
      <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Cari pengguna atau aksi..." />
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState title={search ? "Tidak ada aktivitas yang cocok" : "Belum ada aktivitas tercatat"} />
      ) : (
        <div className="space-y-4">
          <SortControl columns={LOG_SORT_COLUMNS} sort={sort} onChange={changeSort} />
          <div className="overflow-hidden rounded-md border border-base-700 bg-base-800">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <SortTh label="Waktu" sortKey="loggedAt" sort={sort} onSort={toggleSort} className="px-4 py-3 font-medium" />
                  <SortTh label="Pengguna" sortKey="user" sort={sort} onSort={toggleSort} className="px-4 py-3 font-medium" />
                  <SortTh label="Aksi" sortKey="action" sort={sort} onSort={toggleSort} className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700">
                {data.data.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Waktu" className="whitespace-nowrap px-4 py-3 text-ink-faint">{formatDate(log.loggedAt)}</td>
                    <td data-label="Pengguna" className="px-4 py-3 text-ink-muted">
                      {log.user ? log.user.fullName : <span className="italic">Sistem</span>}
                    </td>
                    <td data-label="Aksi" className="px-4 py-3 text-ink">{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-faint">
              Halaman {page} dari {totalPages} · {data.total} total aktivitas
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
        </div>
      )}
      </div>
    </AppShell>
  );
}
