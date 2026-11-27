export default function Panel({ title, action, className = "", children }) {
  return (
    <div className={`rounded-md border border-base-700 bg-base-800 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-base-700 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
