import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, Layers, FolderX } from "lucide-react";

// Panel pohon Area/Gedung di sisi kiri daftar perangkat (padanan "Device Group" Ruijie Cloud).
// selected: "" = semua perangkat, "none" = tanpa area, selain itu id area (string).
export default function AreaTree({ tree, totalCount, unassignedCount, selected, onSelect }) {
  const [collapsed, setCollapsed] = useState(() => new Set());

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav aria-label="Area/Gedung" className="rounded-md border border-base-700 bg-base-800 py-2">
      <p className="px-4 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Area/Gedung</p>

      <Row active={selected === ""} onClick={() => onSelect("")} icon={Layers} label="Semua perangkat" count={totalCount} />

      <div className="mt-0.5">
        {tree.map((node) => (
          <Node key={node.id} node={node} selected={selected} onSelect={onSelect} collapsed={collapsed} onToggle={toggle} />
        ))}
      </div>

      <Row
        active={selected === "none"}
        onClick={() => onSelect("none")}
        icon={FolderX}
        label="Tanpa area"
        count={unassignedCount}
        muted
      />
    </nav>
  );
}

function Node({ node, selected, onSelect, collapsed, onToggle }) {
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && !collapsed.has(node.id);

  return (
    <div>
      <Row
        active={selected === String(node.id)}
        onClick={() => onSelect(String(node.id))}
        icon={isOpen ? FolderOpen : Folder}
        label={node.name}
        count={node.deviceTotal}
        offCount={node.statusTotals.OFF}
        depth={node.depth}
        chevron={
          hasChildren ? (
            <button
              type="button"
              aria-label={isOpen ? "Ciutkan" : "Bentangkan"}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-base-700 hover:text-ink"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <span className="h-5 w-5" />
          )
        }
      />
      {isOpen &&
        node.children.map((child) => (
          <Node key={child.id} node={child} selected={selected} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} />
        ))}
    </div>
  );
}

function Row({ active, onClick, icon: Icon, label, count, offCount = 0, depth = 0, chevron, muted }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      style={{ paddingLeft: 12 + depth * 14 }}
      className={`flex cursor-pointer items-center gap-1.5 py-1.5 pr-3 text-sm outline-none transition-colors focus-visible:bg-base-700 ${
        active ? "bg-accent-dim text-accent" : muted ? "text-ink-muted hover:bg-base-700/50" : "text-ink hover:bg-base-700/50"
      }`}
    >
      {chevron ?? <span className="h-5 w-5" />}
      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {offCount > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-down" title={`${offCount} perangkat Off`} />}
      <span className="shrink-0 text-xs tabular-nums text-ink-faint">{count}</span>
    </div>
  );
}
