import { Inbox, AlertTriangle, Loader2 } from "lucide-react";

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Inbox className="mb-1 h-8 w-8 text-ink-faint" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <AlertTriangle className="mb-1 h-8 w-8 text-signal-down" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">Gagal memuat data</p>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm font-medium text-accent hover:underline">
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Memuat data..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}
