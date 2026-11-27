import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children, width = "max-w-md" }) {
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-md border border-base-700 bg-base-800 scrollbar-thin`}>
        <div className="flex items-center justify-between border-b border-base-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
