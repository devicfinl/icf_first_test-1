import {
  Layers,
  RefreshCw,
  TrendingUp,
  Target,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { CountUp, PercentUp } from "./Animated";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { PvAnalytics, PvProgress } from "../../types/pv";

const NEW_COLOR = "#9c5722";
// Navy, not a light tan: a thin Renew line must read on white.
const RENEW_COLOR = "#142c50";

/** A count, or a count against its base ("value / of") with the share of it. */
function Tile({
  icon: Icon,
  label,
  value,
  of,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  of?: number;
}) {
  return (
    <div className="rounded-xl border border-[#ecdfd1] px-3 py-3 text-center">
      <Icon className="mx-auto size-5 text-clay" />
      <p className="mt-1 text-[12px] text-[#6b6b6b]">{label}</p>
      <p className="text-[16px] font-semibold text-navy">
        <CountUp value={value} />
        {of !== undefined && <span className="font-normal text-[#555]"> / {of.toLocaleString()}</span>}
      </p>
      {of !== undefined && (
        <p className="text-[12px] text-[#6b6b6b]">{of > 0 ? <PercentUp value={value / of} /> : "—"}</p>
      )}
    </div>
  );
}

const chartConfig = {
  new: { label: "New", color: NEW_COLOR },
  renewals: { label: "Renew", color: RENEW_COLOR },
} satisfies ChartConfig;

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** New and renewed subscriptions, added up day by day through the campaign. */
function NewRenewChart({ days }: { days: PvAnalytics["by_day"] }) {
  const points = days.reduce<PvAnalytics["by_day"]>((sums, day) => {
    const last = sums.at(-1);
    sums.push({ day: day.day, new: (last?.new ?? 0) + day.new, renewals: (last?.renewals ?? 0) + day.renewals });
    return sums;
  }, []);

  return (
    <div className="flex min-w-0 flex-col">
      <p className="text-[13px] font-medium text-navy">New and Renew by day</p>
      {points.length < 2 ? (
        <p className="mt-2 grid flex-1 place-items-center rounded-xl bg-[#faf7f3] py-10 text-[13px] text-[#6b6b6b]">
          The graph shows once subscriptions are added on two days.
        </p>
      ) : (
        <>
          <ChartContainer config={chartConfig} className="mt-2 aspect-auto h-56 w-full">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={dayLabel} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ChartTooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-[#ecdfd1] bg-white px-3 py-2 text-[12px] shadow-sm">
                      <p className="font-medium text-navy">{dayLabel(String(label))}</p>
                      {payload.map((item) => (
                        <p key={String(item.dataKey)} className="mt-0.5 flex items-center gap-1.5 text-[#333]">
                          <span className="size-2 rounded-full" style={{ background: item.color }} />
                          {chartConfig[item.dataKey as keyof typeof chartConfig].label}:{" "}
                          {Number(item.value).toLocaleString()}
                        </p>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Line dataKey="new" type="monotone" stroke="var(--color-new)" strokeWidth={2} dot={false} />
              {/* Dashed, so the two lines differ by more than colour. */}
              <Line
                dataKey="renewals"
                type="monotone"
                stroke="var(--color-renewals)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ChartContainer>
          <div className="mt-1 flex justify-center gap-4 text-[12px] text-[#555]">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ background: NEW_COLOR }} />
              New
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: RENEW_COLOR }} />
              Renew
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Work Progress: the title with subscriptions ÷ target as a percentage beside it, the New and
 * Renew line graph across the card, then tiles: units, the target, and New, Renewed and Payment
 * Completed each against their base. Target is the print + digital target from Set Target.
 */
function WorkProgressCard({ progress, byDay }: { progress: PvProgress; byDay: PvAnalytics["by_day"] }) {
  return (
    <section className="rounded-2xl bg-white p-5 sm:p-6">
      {/* The title, with the total % of the target on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-[#f6efe8]">
            <Zap className="size-5 text-navy" />
          </span>
          <h2 className="text-[20px] font-semibold text-navy">
            Work Progress
          </h2>
        </div>
        <div className="text-right">
          <p className="text-[32px] leading-none font-bold text-navy">
            {progress.progress === null ? (
              <span className="text-[18px]">No target set</span>
            ) : (
              <PercentUp value={progress.progress} />
            )}
          </p>
          <p className="mt-1 text-[12px] text-[#6b6b6b]">of target achieved</p>
        </div>
      </div>

      {/* New and Renew day by day, the full width of the card. */}
      <div className="mt-5">
        <NewRenewChart days={byDay} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
        <Tile icon={Layers} label="Total Units" value={progress.total_units} />
        <Tile icon={Target} label="Total Target" value={progress.target} />
        {/* New of the target, renewed of last year's subscribers, paid of this year's. */}
        <Tile icon={TrendingUp} label="New" value={progress.new} of={progress.target} />
        <Tile icon={RefreshCw} label="Renewed" value={progress.renewals} of={progress.renewable} />
        <Tile icon={Wallet} label="Payment Completed" value={progress.paid} of={progress.subscriptions} />
      </div>
    </section>
  );
}

export default WorkProgressCard;
