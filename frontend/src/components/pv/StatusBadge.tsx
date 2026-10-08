const TONE = {
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
} as const;

/** A small rounded status label: Approved, Pending, Rejected, Renew, Renewed. */
function StatusBadge({ tone, children }: { tone: keyof typeof TONE; children: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[12px] whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

export default StatusBadge;
