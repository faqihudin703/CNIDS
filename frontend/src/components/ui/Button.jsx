const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent/90 disabled:bg-accent/40",
  secondary: "bg-base-700 text-ink hover:bg-base-600 disabled:opacity-40",
  danger: "bg-signal-down-dim text-signal-down hover:bg-signal-down/20 disabled:opacity-40",
  ghost: "text-ink-muted hover:text-ink hover:bg-base-800 disabled:opacity-40",
};

const SIZES = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-3.5 py-2 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
