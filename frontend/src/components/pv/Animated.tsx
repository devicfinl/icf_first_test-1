import type { CSSProperties, ReactNode } from "react";

import { useAnimatedValue } from "../../hooks/useAnimatedValue";

/** A whole number that counts up to `value`. */
export function CountUp({ value }: { value: number }) {
  return <>{Math.round(useAnimatedValue(value)).toLocaleString()}</>;
}

/** A percentage (0.6498 -> "64.98%") that counts up. */
export function PercentUp({ value }: { value: number }) {
  const shown = useAnimatedValue(value * 100);
  return <>{`${shown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</>;
}

/** A progress bar whose fill grows to `share` (0..1). */
export function GrowBar({ share, className, track = "bg-[#f3ebe2]" }: { share: number; className: string; track?: string }) {
  const width = useAnimatedValue(Math.min(Math.max(share, 0), 1) * 100);
  return (
    <div className={`h-2 rounded-full ${track}`}>
      <div className={`h-2 rounded-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Fades and slides a card in; `order` staggers cards shown together. */
export function Reveal({
  order = 0,
  as: Tag = "div",
  className = "",
  children,
}: {
  order?: number;
  /** "li" inside a list. */
  as?: "div" | "li" | "section";
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = { animationDelay: `${order * 70}ms`, animationFillMode: "both" };
  return (
    <Tag
      className={`animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
