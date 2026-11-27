import { useState } from "react";

// Tooltip pool untuk prefix. Memakai position: fixed (bukan absolute) supaya tidak terpotong
// oleh container tabel yang overflow-x-auto. Muncul saat hover maupun fokus keyboard.
export default function PoolHint({ pool, children }) {
  const [pos, setPos] = useState(null);

  function show(e) {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 296)), y: r.bottom + 6 });
  }

  return (
    <>
      <span
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        className="cursor-help border-b border-dotted border-ink-faint font-mono outline-none focus-visible:border-accent"
      >
        {children}
      </span>

      {pos && (
        <div
          role="tooltip"
          style={{ left: pos.x, top: pos.y }}
          className="pointer-events-none fixed z-50 w-72 rounded-md border border-base-600 bg-base-950 p-3 text-xs"
        >
          {pool ? (
            <>
              <p className="mb-2 font-medium uppercase tracking-wide text-ink-faint">IP Pool</p>
              <p className="font-mono text-sm text-ink">{pool.range}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-muted">
                <dt>Network</dt>
                <dd className="font-mono text-ink">{pool.cidr}</dd>
                <dt>Broadcast</dt>
                <dd className="font-mono text-ink">{pool.broadcast}</dd>
                <dt>Host</dt>
                <dd className="text-ink">{pool.hosts.toLocaleString("id-ID")} alamat</dd>
              </dl>
            </>
          ) : (
            <p className="text-ink-muted">Pool dihitung otomatis dari IP interface + prefix.</p>
          )}
        </div>
      )}
    </>
  );
}
