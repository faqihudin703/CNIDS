import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

/**
 * Kerangka halaman. >= lg (1024px): sidebar tetap di kiri. Tablet potret & HP: sidebar menjadi laci
 * (drawer) yang dibuka dari tombol menu di header. Konten dibatasi lebarnya agar tetap nyaman di monitor 4K.
 */
export default function AppShell({ title, description, action, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-base-900">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
        <header className="sticky top-0 z-10 border-b border-base-700 bg-base-900/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[110rem] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu"
            className="-ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-base-800 hover:text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-ink sm:text-lg">{title}</h1>
            {description && <p className="mt-0.5 truncate text-xs text-ink-muted sm:text-sm">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[110rem] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
