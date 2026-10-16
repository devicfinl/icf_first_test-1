import { CountUp, GrowBar } from "./Animated";
import { formatAmount, formatPercent } from "../../lib/pv";
import type { PvAnalytics } from "../../types/pv";

/** A mode's subscriptions against its target from Set Target. */
function ModeRow({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const share = target > 0 ? value / target : null;
  return (
    <li>
      <div className="flex justify-between gap-3 text-[13px]">
        <span className="text-[#333]">{label}</span>
        <span className="font-medium text-navy">
          <CountUp value={value} />
          <span className="font-normal text-[#555]"> / {target > 0 ? target.toLocaleString() : "—"}</span>
          <span className="ml-2 text-[12px] font-normal text-[#6b6b6b]">{formatPercent(share)}</span>
        </span>
      </div>
      <div className="mt-1.5">
        <GrowBar share={Math.min(share ?? 0, 1)} className={color} />
      </div>
    </li>
  );
}

/** The amount received against the amount, as a progress line, with what is still pending. */
function AmountProgress({ money }: { money: PvAnalytics["amounts"][number] }) {
  const share = money.total > 0 ? money.received / money.total : null;
  return (
    <>
      <p className="text-[20px] font-semibold text-navy">{formatAmount(money.total, money.currency)}</p>
      <div className="mt-1 flex justify-between gap-3 text-[13px]">
        <span className="text-[#333]">{formatAmount(money.received, money.currency)} received</span>
        <span className="font-medium text-navy">{formatPercent(share)}</span>
      </div>
      <div className="mt-1.5">
        <GrowBar share={share ?? 0} className="bg-clay" />
      </div>
      <p className="mt-1.5 text-[12px] text-[#6b6b6b]">
        {formatAmount(money.total - money.received, money.currency)} pending
      </p>
    </>
  );
}

/**
 * Print and digital subscriptions against their targets, then the amount collected per
 * currency with the amount received as a progress line. Print&Digital is no longer
 * offered; old rows of it count as print.
 */
function AnalyticsBreakdown({ analytics }: { analytics: PvAnalytics }) {
  const { totals } = analytics;

  return (
    <>
      <section className="rounded-2xl bg-white px-5 py-4">
        <h2 className="text-[15px] font-semibold text-navy">By subscription mode</h2>
        <ul className="mt-3 space-y-3">
          {/* Each mode is named, so its colour is not the only way to tell them apart. */}
          <ModeRow label="Print" value={totals.print} target={totals.target_print} color="bg-navy" />
          <ModeRow label="Digital" value={totals.digital} target={totals.target_digital} color="bg-clay" />
        </ul>
      </section>
      <section className="rounded-2xl bg-white px-5 py-4">
        <h2 className="text-[15px] font-semibold text-navy">Amount</h2>
        {analytics.amounts.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#6b6b6b]">No subscriptions yet.</p>
        ) : (
          <ul className="mt-3 space-y-5">
            {analytics.amounts.map((money) => (
              <li key={money.currency}>
                <AmountProgress money={money} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default AnalyticsBreakdown;
