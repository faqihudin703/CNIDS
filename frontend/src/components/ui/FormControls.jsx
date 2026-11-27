import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-signal-down">{error}</span>}
    </label>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink focus:border-accent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Input password dengan tombol mata untuk menampilkan/menyembunyikan isinya.
export function PasswordInput({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Sembunyikan password" : "Tampilkan password";
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={`pr-11 ${className}`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-ink-faint transition-colors hover:text-ink focus-visible:text-ink"
      >
        {visible ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
      </button>
    </div>
  );
}
