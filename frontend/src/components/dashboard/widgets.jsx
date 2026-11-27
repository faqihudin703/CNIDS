import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export function StatCard({ icon: Icon, label, value, hint, to }) {
  const body = (
    <div className="group h-full rounded-md border border-base-700 bg-base-800 p-4 transition-colors hover:border-base-600">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-accent-dim text-accent">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        {to && <ArrowUpRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-ink" />}
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

// Daftar batang horizontal. Lebar batang relatif terhadap nilai terbesar.
export function BarList({ items, barClass = "bg-accent", empty = "Belum ada data." }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key ?? item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{item.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">{item.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-base-700">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.max((item.count / max) * 100, item.count > 0 ? 4 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Donut SVG. `strokeClass` harus berupa class Tailwind utuh (mis. "stroke-accent") agar tidak ter-purge.
export function Donut({ segments, centerValue, centerLabel }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-base-700" />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / total) * C;
                const circle = (
                  <circle
                    key={s.label}
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    strokeWidth="12"
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                    className={s.strokeClass}
                  />
                );
                offset += len;
                return circle;
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-ink">{centerValue}</span>
          <span className="text-xs text-ink-faint">{centerLabel}</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${s.dotClass}`} />
              <span className="truncate text-ink-muted">{s.label}</span>
            </span>
            <span className="tabular-nums text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoverageRow({ label, done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">
          {done}/{total} <span className="text-ink-faint">· {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-base-700">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
