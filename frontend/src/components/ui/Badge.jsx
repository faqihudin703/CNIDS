const VARIANTS = {
  up: "bg-signal-up-dim text-signal-up",
  down: "bg-signal-down-dim text-signal-down",
  unknown: "bg-base-700 text-ink-muted",
  neutral: "bg-base-700 text-ink-muted",
  accent: "bg-accent-dim text-accent",
  amber: "bg-signal-warn-dim text-signal-warn",
};

export default function Badge({ variant = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium ${VARIANTS[variant] || VARIANTS.neutral}`}
    >
      {variant === "up" && <span className="h-1.5 w-1.5 rounded-full bg-signal-up" />}
      {variant === "down" && <span className="h-1.5 w-1.5 rounded-full bg-signal-down" />}
      {children}
    </span>
  );
}
