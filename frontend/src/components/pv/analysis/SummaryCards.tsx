import { CountUp, GrowBar } from "../Animated";
import { formatAmount, formatPercent } from "../../../lib/pv";
import type { AnalysisSummary } from "../../../types/pvAnalysis";

/** A count; with `of`, the count against its base ("value / of what"), its share and a progress line. */
function Card({
  label,
  value,
  hint,
  of,
  inset,
}: {
  inset?: boolean;
  label: string;
  value: number;
  hint?: string;
  of?: { value: number; label: string; color: string };
}) {
  const share = of && of.value > 0 ? value / of.value : null;
  return (
    <div className={`${inset ? CARD_INSET : CARD} px-4 py-3`}>
      <p className="text-[12px] text-[#6b6b6b]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold text-navy">
        <CountUp value={value} />
        {of && (
          <span className="text-[13px] font-normal text-[#555]">
            {" "}
            / {of.value > 0 ? of.value.toLocaleString() : "—"} {of.label}
          </span>
        )}
      </p>
      {of ? (
        <>
          <div className="mt-1.5">
            <GrowBar share={share ?? 0} className={of.color} />
          </div>
          <p className="mt-1 text-[12px] text-[#6b6b6b]">{formatPercent(share)}</p>
        </>
      ) : (
        hint && <p className="text-[12px] text-[#6b6b6b]">{hint}</p>
      )}
    </div>
  );
}

// On the page, a card is white; inside a white section (inset), it is outlined instead.
const CARD = "rounded-2xl bg-white";
const CARD_INSET = "rounded-xl border border-[#ecdfd1]";

const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : undefined);

// Each card's line in a brand colour; New is clay and Renewal navy, as in the Analytics graph.
const LINE = {
  total: "bg-navy-deep",
  new: "bg-clay",
  renewal: "bg-navy",
  paid: "bg-clay-deep",
  unpaid: "bg-sand",
  amount: "bg-clay",
} as const;

/**
 * Total, New, Renewal, Paid, Not paid and the amount collected, for the active filters. With
 * `against`, each is shown against its base with a progress line: Total and New against the Set
 * Target total, Renewal against last year's subscriptions, Paid and Not paid against the total,
 * and the amount received against the amount.
 */
function SummaryCards({
  summary,
  against = false,
  inset = false,
}: {
  summary: AnalysisSummary;
  against?: boolean;
  /** Inside a white section: outlined cards. */
  inset?: boolean;
}) {
  const { totals, amounts, target } = summary;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card inset={inset} label="Total" value={totals.subscriptions} of={against ? { value: target, label: "target", color: LINE.total } : undefined} />
      <Card
        inset={inset}
        label="New"
        value={totals.new}
        hint={share(totals.new, totals.subscriptions)}
        of={against ? { value: target, label: "target", color: LINE.new } : undefined}
      />
      <Card
        inset={inset}
        label="Renewal"
        value={totals.renewals}
        hint={share(totals.renewals, totals.subscriptions)}
        of={against ? { value: totals.renewable, label: "last year", color: LINE.renewal } : undefined}
      />
      <Card
        inset={inset}
        label="Paid"
        value={totals.paid}
        hint={share(totals.paid, totals.subscriptions)}
        of={against ? { value: totals.subscriptions, label: "total", color: LINE.paid } : undefined}
      />
      <Card
        inset={inset}
        label="Not paid"
        value={totals.unpaid}
        hint={share(totals.unpaid, totals.subscriptions)}
        of={against ? { value: totals.subscriptions, label: "total", color: LINE.unpaid } : undefined}
      />
      <div className={`${inset ? CARD_INSET : CARD} px-4 py-3`}>
        <p className="text-[12px] text-[#6b6b6b]">Amount collected</p>
        {amounts.length === 0 ? (
          <p className="mt-1 text-[24px] font-semibold text-[#999]">—</p>
        ) : (
          amounts.map((money) => (
            <div key={money.currency} className="mt-1">
              <p className="text-[16px] font-semibold text-navy">
                {formatAmount(money.received, money.currency)}
                {against && <span className="text-[13px] font-normal text-[#555]"> / {formatAmount(money.total, money.currency)}</span>}
              </p>
              {against && (
                <div className="mt-1.5">
                  <GrowBar share={money.total > 0 ? money.received / money.total : 0} className={LINE.amount} />
                </div>
              )}
              <p className="mt-1 text-[12px] text-[#6b6b6b]">
                {against && `${formatPercent(money.total > 0 ? money.received / money.total : null)} · `}
                {formatAmount(money.pending, money.currency)} pending
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SummaryCards;
