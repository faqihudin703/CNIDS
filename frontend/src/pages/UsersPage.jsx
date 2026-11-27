import { useMemo, useState } from "react";
import { Plus, Pencil, KeyRound, Trash2, UserX, UserCheck } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Field, Input, PasswordInput, Select } from "../components/ui/FormControls";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import { useFetch } from "../hooks/useFetch";
import { useTableFilter } from "../hooks/useTableFilter";
import { SearchBox, FilterSelect, FilterSummary } from "../components/ui/FilterBar";
import { useSort } from "../hooks/useSort";
import { sortRows } from "../utils/sort";
import { SortTh, SortControl } from "../components/ui/SortControls";
import { useAuth } from "../context/AuthContext";
import { listUsers, createUser, updateUser, resetUserPassword, deleteUser } from "../api/users";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, formatDateShort } from "../utils/format";

// Halaman ini hanya bisa dibuka Superadmin (lihat SuperAdminRoute di App.jsx);
// backend juga menolak peran lain pada seluruh endpoint /api/users.
const USER_SORT = {
  name: (u) => u.fullName,
  username: (u) => u.username,
  role: (u) => ROLE_LABELS[u.role],
  status: (u) => (u.isActive ? "Aktif" : "Nonaktif"),
  devices: (u) => u._count?.devicesCreated ?? 0,
  created: (u) => new Date(u.createdAt).getTime(),
};
// Kolom yang tampil: Nama, Username, Peran, Status, Perangkat dicatat, Dibuat. Pencarian hanya memakai teks ini.
const USER_SEARCH = [
  (u) => u.fullName, (u) => u.username, (u) => ROLE_LABELS[u.role],
  (u) => (u.isActive ? "Aktif" : "Nonaktif"), (u) => u._count?.devicesCreated, (u) => formatDateShort(u.createdAt),
];
const USER_FILTERS = { role: (u) => u.role, status: (u) => (u.isActive ? "Aktif" : "Nonaktif") };
const USER_FILTER_LABELS = { role: (v) => ROLE_LABELS[v] ?? v };
const USER_SORT_COLUMNS = [
  { key: "name", label: "Nama" },
  { key: "username", label: "Username" },
  { key: "role", label: "Peran" },
  { key: "status", label: "Status" },
  { key: "devices", label: "Perangkat dicatat" },
  { key: "created", label: "Dibuat" },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [formUser, setFormUser] = useState(null); // null = tutup, {} = tambah, {id,...} = ubah
  const [resetTarget, setResetTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Daftar dimuat sekali; pencarian & filter berjalan langsung di layar, opsi filter mengikuti baris yang tampil.
  const { data, error, isLoading, refetch } = useFetch(listUsers, []);
  const all = data?.data ?? [];
  const f = useTableFilter(all, { searchAccessors: USER_SEARCH, filters: USER_FILTERS, labels: USER_FILTER_LABELS });
  const { sort, toggle, setSort } = useSort();
  const rows = useMemo(() => sortRows(f.filtered, sort, USER_SORT), [f.filtered, sort]);

  async function toggleActive(target) {
    const activating = !target.isActive;
    if (!activating && !window.confirm(`Nonaktifkan akun "${target.username}"? Pengguna ini tidak akan bisa masuk lagi.`)) {
      return;
    }
    setBusyId(target.id);
    try {
      await updateUser(target.id, { isActive: activating });
      refetch();
    } catch (err) {
      window.alert(err.response?.data?.error || "Gagal mengubah status akun");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(target) {
    if (!window.confirm(`Hapus akun "${target.username}" secara permanen?`)) return;
    setBusyId(target.id);
    try {
      await deleteUser(target.id);
      refetch();
    } catch (err) {
      window.alert(err.response?.data?.error || "Gagal menghapus akun");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="Pengguna"
      description="Kelola akun user, admin, dan superadmin"
      action={
        <Button size="sm" onClick={() => setFormUser({})}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tambah Pengguna</span>
          <span className="sm:hidden">Tambah</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchBox value={f.query} onChange={f.setQuery} placeholder="Cari nama, username, peran, status..." />
          <FilterSelect label="Semua peran" value={f.values.role ?? ""} onChange={(v) => f.setValue("role", v)} options={f.options("role")} />
          <FilterSelect label="Semua status" value={f.values.status ?? ""} onChange={(v) => f.setValue("status", v)} options={f.options("status")} />
        </div>
        {!isLoading && !error && <FilterSummary shown={rows.length} total={all.length} active={f.active} onReset={f.reset} unit="pengguna" />}

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada pengguna ditemukan" description="Coba ubah kata kunci atau filter." />
        ) : (
          <>
          <SortControl columns={USER_SORT_COLUMNS} sort={sort} onChange={setSort} />
          <div className="overflow-x-auto rounded-md border border-base-700 bg-base-800">
            <table className="table-stack w-full text-sm">
              <thead>
                <tr className="border-b border-base-700 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <SortTh label="Nama" sortKey="name" sort={sort} onSort={toggle} className="px-4 py-3 font-medium" />
                  <SortTh label="Username" sortKey="username" sort={sort} onSort={toggle} className="px-4 py-3 font-medium" />
                  <SortTh label="Peran" sortKey="role" sort={sort} onSort={toggle} className="px-4 py-3 font-medium" />
                  <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} className="px-4 py-3 font-medium" />
                  <SortTh label="Perangkat dicatat" sortKey="devices" sort={sort} onSort={toggle} className="whitespace-nowrap px-4 py-3 font-medium" />
                  <SortTh label="Dibuat" sortKey="created" sort={sort} onSort={toggle} className="px-4 py-3 font-medium" />
                  <th className="w-32 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700">
                {rows.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-base-700/30">
                      <td data-label="Nama" className="px-4 py-3 font-medium text-ink">
                        {u.fullName}
                        {isSelf && <span className="ml-2 text-xs font-normal text-ink-faint">(Anda)</span>}
                      </td>
                      <td data-label="Username" className="px-4 py-3 font-mono text-ink-muted">{u.username}</td>
                      <td data-label="Peran" className="px-4 py-3">
                        <Badge variant={u.role === "SUPERADMIN" ? "accent" : "neutral"}>{ROLE_LABELS[u.role]}</Badge>
                      </td>
                      <td data-label="Status" className="px-4 py-3">
                        <Badge variant={u.isActive ? "up" : "unknown"}>{u.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td data-label="Perangkat dicatat" className="px-4 py-3 tabular-nums text-ink-muted">{u._count?.devicesCreated ?? 0}</td>
                      <td data-label="Dibuat" className="whitespace-nowrap px-4 py-3 text-ink-faint">{formatDateShort(u.createdAt)}</td>
                      <td data-label="" className="px-4 py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconButton title="Ubah" onClick={() => setFormUser(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton title="Atur ulang password" onClick={() => setResetTarget(u)}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </IconButton>
                          {!isSelf && (
                            <>
                              <IconButton
                                title={u.isActive ? "Nonaktifkan" : "Aktifkan"}
                                disabled={busyId === u.id}
                                onClick={() => toggleActive(u)}
                              >
                                {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                              </IconButton>
                              <IconButton
                                title="Hapus"
                                danger
                                disabled={busyId === u.id}
                                onClick={() => handleDelete(u)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {formUser && (
        <UserFormModal
          user={formUser}
          isSelf={formUser.id === currentUser?.id}
          onClose={() => setFormUser(null)}
          onSaved={() => {
            setFormUser(null);
            refetch();
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => setResetTarget(null)}
        />
      )}
    </AppShell>
  );
}

function IconButton({ title, danger, children, ...props }) {
  return (
    <button
      title={title}
      className={`rounded p-1.5 text-ink-muted hover:bg-base-700 disabled:opacity-40 ${
        danger ? "hover:text-signal-down" : "hover:text-ink"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

function errorMessage(err, fallback) {
  if (err.response?.status === 409) return err.response.data.error;
  return err.response?.data?.details?.[0]?.message || err.response?.data?.error || fallback;
}

function UserFormModal({ user, isSelf, onClose, onSaved }) {
  const isEdit = Boolean(user.id);
  const [form, setForm] = useState({
    username: user.username || "",
    fullName: user.fullName || "",
    role: user.role || "MAHASISWA_DOSEN",
    password: "",
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) {
      setError("Nama lengkap wajib diisi");
      return;
    }
    if (!isEdit && form.password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateUser(user.id, { fullName: form.fullName.trim(), role: form.role });
      } else {
        await createUser({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role,
        });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan pengguna"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? "Ubah Pengguna" : "Tambah Pengguna"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Username" hint={isEdit ? "Username tidak dapat diubah" : "Huruf, angka, titik, garis bawah, strip"}>
          <Input
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            disabled={isEdit}
            autoFocus={!isEdit}
            required
          />
        </Field>

        <Field label="Nama lengkap">
          <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} autoFocus={isEdit} required />
        </Field>

        <Field
          label="Peran"
          hint={isSelf ? "Peran akun Anda sendiri tidak dapat diubah" : ROLE_DESCRIPTIONS[form.role]}
        >
          <Select value={form.role} onChange={(e) => update("role", e.target.value)} disabled={isSelf}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {!isEdit && (
          <Field label="Password awal" hint="Minimal 8 karakter. Minta pengguna menyimpannya dengan aman.">
            <PasswordInput
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
        )}

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Pengguna"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetUserPassword(user.id, password);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Gagal mengatur ulang password"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (saved) {
    return (
      <Modal title="Atur Ulang Password" onClose={onDone}>
        <div className="space-y-4">
          <p className="text-sm text-ink">Password untuk &ldquo;{user.username}&rdquo; berhasil diubah.</p>
          <div className="flex justify-end">
            <Button onClick={onDone}>Selesai</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Atur Ulang Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          Atur password baru untuk <span className="font-medium text-ink">{user.fullName}</span> ({user.username}).
        </p>

        <Field label="Password baru" hint="Minimal 8 karakter">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
        </Field>

        <Field label="Ulangi password baru">
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan Password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
