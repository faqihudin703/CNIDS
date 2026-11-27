import { useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import Badge from "../ui/Badge";
import { formatDate } from "../../utils/format";
import { formatInterval } from "../../utils/netInput";
import { triggerStatusCheck } from "../../api/devices";

const STATUS_LABELS = { UP: "Aktif", DOWN: "Tidak Merespons", UNKNOWN: "Belum Diketahui" };
const STATUS_VARIANTS = { UP: "up", DOWN: "down", UNKNOWN: "unknown" };

export default function DeviceStatusPanel({ deviceId, monitorMethod, pingIntervalSec, latestStatus, canCheck, onChecked }) {
  const [isChecking, setIsChecking] = useState(false);

  if (monitorMethod === "NONE") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-faint">
        <Zap className="h-3.5 w-3.5" />
        Monitoring belum diaktifkan untuk perangkat ini
      </div>
    );
  }

  async function handleCheck() {
    setIsChecking(true);
    try {
      await triggerStatusCheck(deviceId);
      await onChecked(); // muat ulang status, perangkat (badge On/Off), dan peringatan sekaligus
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {latestStatus ? (
          <>
            <Badge variant={STATUS_VARIANTS[latestStatus.status]}>{STATUS_LABELS[latestStatus.status]}</Badge>
            <span className="text-xs text-ink-faint">
              {latestStatus.latencyMs != null && `${latestStatus.latencyMs}ms · `}
              Dicek {formatDate(latestStatus.checkedAt)}
              {pingIntervalSec ? ` · otomatis tiap ${formatInterval(pingIntervalSec)}` : ""}
            </span>
          </>
        ) : (
          <span className="text-sm text-ink-muted">Belum pernah dicek</span>
        )}
      </div>

      {canCheck && (
        <button
          onClick={handleCheck}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-base-700 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "Memeriksa..." : "Cek Sekarang"}
        </button>
      )}
    </div>
  );
}
