import { CountUp, GrowBar } from "./Animated";
import { formatAmount, modeLabel } from "../../lib/pv";
import { SUBSCRIPTION_MODES, type PvAnalytics } from "../../types/pv";

const MODE_COLOR = {
  Print: "bg-navy",
  Digital: "bg-clay",
  "Print&Digital": "bg-[#c9a27e]",
} as const;

/** Amount collected (and received) per currency, and subscriptions per mode. */
function AnalyticsBreakdown({ analytics }: { analytics: PvAnalytics }) {
  const modeMax = Math.max(
    ...SUBSCRIPTION_MODES.map((mode) => analytics.by_mode[mode]),
  );

  return (
    <>
      <section className="rounded-2xl bg-white px-5 py-4">
        <h2 className="text-[15px] font-semibold text-navy">Amount</h2>
        {analytics.amounts.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#6b6b6b]">
            No subscriptions yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {analytics.amounts.map((money) => (
              <li key={money.currency}>
                <p className="text-[20px] font-semibold text-navy">
                  {formatAmount(money.total, money.currency)}
                </p>
                <p className="text-[12px] text-[#6b6b6b]">
                  {formatAmount(money.received, money.currency)} received
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white px-5 py-4">
        <h2 className="text-[15px] font-semibold text-navy">
          By subscription mode
        </h2>
        <ul className="mt-3 space-y-3">
          {SUBSCRIPTION_MODES.map((mode) => (
            <li key={mode}>
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="text-[#333]">{modeLabel(mode)}</span>
                <span className="font-medium text-navy">
                  <CountUp value={analytics.by_mode[mode]} />
                </span>
              </div>
              <div className="mt-1.5">
                <GrowBar
                  share={modeMax > 0 ? analytics.by_mode[mode] / modeMax : 0}
                  className={MODE_COLOR[mode]}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default AnalyticsBreakdown;
