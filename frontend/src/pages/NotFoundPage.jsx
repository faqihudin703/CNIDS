import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base-900 px-4 text-center">
      <FileQuestion className="h-10 w-10 text-ink-faint" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-ink">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        Halaman yang Anda cari tidak tersedia atau mungkin telah dipindahkan.
      </p>
      <Link to="/" className="mt-2 text-sm font-medium text-accent hover:underline">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
