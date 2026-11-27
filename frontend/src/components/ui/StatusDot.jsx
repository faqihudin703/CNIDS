import { ONLINE_STATUS_LABELS, ONLINE_STATUS_DOT, ONLINE_STATUS_TEXT, ONLINE_STATUS_HINTS } from "../../utils/format";

// Indikator status perangkat ala Ruijie Cloud: titik berwarna + label (On / Off / Never On).
export default function StatusDot({ status, showLabel = true }) {
  const key = ONLINE_STATUS_LABELS[status] ? status : "NEVER_ON";
  return (
    <span className="inline-flex items-center gap-2" title={ONLINE_STATUS_HINTS[key]}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${ONLINE_STATUS_DOT[key]}`} />
      {showLabel && <span className={`text-sm font-medium ${ONLINE_STATUS_TEXT[key]}`}>{ONLINE_STATUS_LABELS[key]}</span>}
    </span>
  );
}
