import {
  Layers,
  RefreshCw,
  TrendingUp,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { CountUp, PercentUp } from "./Animated";
import { useAnimatedValue } from "../../hooks/useAnimatedValue";
import type { PvProgress } from "../../types/pv";

const NEW_COLOR = "#9c5722";
const RENEW_COLOR = "#d4b08c";
const TRACK_COLOR = "#f3ebe2";

/** Ring of subscriptions over target: New then Renew, the rest is the track. */
function ProgressRing({ progress }: { progress: PvProgress }) {
  const radius = 78;
  const stroke = 22;
  const size = (radius + stroke / 2) * 2;
  const circumference = 2 * Math.PI * radius;
  // Without a target the ring still shows how the subscriptions split into new and renew.
  const scale = Math.max(progress.target, progress.subscriptions, 1);
  // The arcs sweep round from empty when the numbers arrive or change.
  const newLength = useAnimatedValue(
    (Math.min(progress.new, scale) / scale) * circumference,
    1100,
  );
  const renewLength = useAnimatedValue(
    (Math.max(Math.min(progress.renewals, scale - progress.new), 0) / scale) *
      circumference,
    1100,
  );

  const arc = (length: number, offset: number, color: string) => (
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeDasharray={`${length} ${circumference}`}
      strokeDashoffset={-offset}
    />
  );

  return (
    <div className="relative size-[200px] shrink-0">
      {/* Starts at the bottom left and runs clockwise, like the design. */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full rotate-[135deg]"
        aria-hidden
      >
        {arc(circumference, 0, TRACK_COLOR)}
        {newLength > 0.5 && arc(newLength, 0, NEW_COLOR)}
        {renewLength > 0.5 && arc(renewLength, newLength, RENEW_COLOR)}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[26px] leading-none font-bold text-navy">
            <CountUp value={progress.subscriptions} />
          </p>
          <p className="mt-1 text-[10px] text-[#555]">Subscription</p>
          <div className="mx-auto my-1.5 h-px w-16 bg-[#cfc6bc]" />
          <p className="text-[22px] leading-none font-bold text-navy">
            <CountUp value={progress.target} />
          </p>
          <p className="mt-1 text-[10px] text-[#555]">Target</p>
          <div className="mt-1.5 space-y-0.5 text-[10px] text-[#555]">
            <p className="flex items-center justify-center gap-1">
              New <span className="size-2" style={{ background: NEW_COLOR }} />
            </p>
            <p className="flex items-center justify-center gap-1">
              Renew{" "}
              <span className="size-2" style={{ background: RENEW_COLOR }} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#ecdfd1] px-3 py-3 text-center">
      <Icon className="mx-auto size-5 text-clay" />
      <p className="mt-1 text-[12px] text-[#6b6b6b]">{label}</p>
      <p className="text-[16px] font-semibold text-navy">
        <CountUp value={value} />
      </p>
    </div>
  );
}

/**
 * Work Progress: subscriptions ÷ target as a percentage, the ring with New and Renew, and four
 * tiles. Target is the membership count.
 */
function WorkProgressCard({ progress }: { progress: PvProgress }) {
  return (
    <section className="rounded-2xl bg-white p-5 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="self-stretch sm:self-auto">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#f6efe8]">
              <Zap className="size-5 text-navy" />
            </span>
            <h2 className="text-[20px] font-semibold text-navy">
              Work Progress
            </h2>
          </div>
          <p className="mt-6 text-[44px] leading-none font-bold text-navy">
            {progress.progress === null ? (
              "No target set"
            ) : (
              <PercentUp value={progress.progress} />
            )}
          </p>
        </div>
        <ProgressRing progress={progress} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={Layers} label="Total Units" value={progress.total_units} />
        <Tile
          icon={UsersRound}
          label="Membership"
          value={progress.membership}
        />
        <Tile icon={TrendingUp} label="New" value={progress.new} />
        <Tile icon={RefreshCw} label="Renew" value={progress.renewals} />
      </div>
    </section>
  );
}

export default WorkProgressCard;
