import { CountUp } from "../Animated";
import { formatAmount } from "../../../lib/pv";
import type { AnalysisSummary } from "../../../types/pvAnalysis";

function Card({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-[12px] text-[#6b6b6b]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold text-navy">
        <CountUp value={value} />
      </p>
      {hint && <p className="text-[12px] text-[#6b6b6b]">{hint}</p>}
    </div>
  );
}

const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : undefined);

/** Total, New, Renewal, Paid, Not paid and the amount collected, for the active filters. */
function SummaryCards({ summary }: { summary: AnalysisSummary }) {
  const { totals, amounts } = summary;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card label="Total" value={totals.subscriptions} />
      <Card label="New" value={totals.new} hint={share(totals.new, totals.subscriptions)} />
      <Card label="Renewal" value={totals.renewals} hint={share(totals.renewals, totals.subscriptions)} />
      <Card label="Paid" value={totals.paid} hint={share(totals.paid, totals.subscriptions)} />
      <Card label="Not paid" value={totals.unpaid} hint={share(totals.unpaid, totals.subscriptions)} />
      <div className="rounded-2xl bg-white px-4 py-3">
        <p className="text-[12px] text-[#6b6b6b]">Amount collected</p>
        {amounts.length === 0 ? (
          <p className="mt-1 text-[24px] font-semibold text-[#999]">—</p>
        ) : (
          amounts.map((money) => (
            <div key={money.currency} className="mt-1">
              <p className="text-[16px] font-semibold text-navy">{formatAmount(money.received, money.currency)}</p>
              <p className="text-[12px] text-[#6b6b6b]">{formatAmount(money.pending, money.currency)} pending</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SummaryCards;
