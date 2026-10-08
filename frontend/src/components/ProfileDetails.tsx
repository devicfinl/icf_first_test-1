import type { ComponentType, ReactNode } from "react";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";

import Loader from "./loading-ui/Loader";
import { Card } from "@/components/ui/card";

type Icon = ComponentType<{ className?: string }>;

const TONES = {
  blue: "bg-[#e9effa] text-[#2f5aa8]",
  orange: "bg-[#fbeee2] text-clay",
  green: "bg-[#e5f5ec] text-emerald-700",
  red: "bg-[#fdeaea] text-red-600",
  violet: "bg-[#efedfb] text-[#5b4fc4]",
} as const;
export type Tone = keyof typeof TONES;

/** Copies a value and confirms with a toast. */
async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy. Please copy it by hand.");
  }
}

type RowProps = {
  icon: Icon;
  label: string;
  value: ReactNode;
  /** Brand accent, for values that can be acted on (phone numbers). */
  accent?: boolean;
  /** Adds a copy button for this text. */
  copy?: string;
};

/** One line of a card: icon, grey label, then the value. Blank values are left out. */
export function InfoRow({ icon: RowIcon, label, value, accent = false, copy }: RowProps) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="grid grid-cols-[20px_minmax(0,120px)_1fr] items-center gap-3 border-b border-[#f0ebe5] py-2.5 last:border-b-0 sm:grid-cols-[20px_170px_1fr]">
      <RowIcon className="size-[18px] text-[#6b7280]" />
      <dt className="text-[14px] text-[#6b6b6b]">{label}</dt>
      <dd className={`flex min-w-0 items-center gap-2.5 text-[14px] break-words ${accent ? "text-clay" : "text-navy"}`}>
        <span className="min-w-0">{value}</span>
        {copy && (
          <button
            type="button"
            onClick={() => void copyValue(label, copy)}
            aria-label={`Copy ${label}`}
            className="shrink-0 rounded p-0.5 text-[#555] hover:bg-[#f3ebe2]"
          >
            <Copy className="size-4" />
          </button>
        )}
      </dd>
    </div>
  );
}

/** A green/red dot and word, e.g. "● Active". */
export function StatusDot({ tone, children }: { tone: "green" | "red" | "amber"; children: ReactNode }) {
  const color = { green: "text-emerald-600", red: "text-red-600", amber: "text-amber-600" }[tone];
  const dot = { green: "bg-emerald-500", red: "bg-red-500", amber: "bg-amber-500" }[tone];
  return (
    <span className={`inline-flex items-center gap-2 font-medium ${color}`}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  );
}

type CardProps = {
  title: string;
  icon: Icon;
  tone: Tone;
  children: ReactNode;
  /** Hides the card when every value feeding it is blank. */
  empty?: boolean;
  /** Animation stagger position. */
  index?: number;
};

/**
 * A profile card: tinted round icon, title and an Edit button, then the rows. Members cannot edit
 * their record from here yet (it is kept in the legacy admin), so Edit is shown disabled.
 */
export function InfoCard({ title, icon: CardIcon, tone, children, empty = false, index = 0 }: CardProps) {
  if (empty) return null;

  return (
    <section
      style={{ animationDelay: `${index * 60}ms` }}
      className="min-w-0 rounded-2xl border border-[#efe9e2] bg-white px-5 pt-4 pb-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none"
    >
      <div className="mb-1 flex items-center gap-3.5">
        <span className={`grid size-11 shrink-0 place-items-center rounded-full ${TONES[tone]}`}>
          <CardIcon className="size-5" />
        </span>
        <h2 className="flex-1 text-[18px] font-semibold text-navy">{title}</h2>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-[#e2ddd6] bg-white px-3 py-1.5 text-[13px] text-[#444] opacity-70"
        >
          <Pencil className="size-3.5" />
          Edit
        </button>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

/** Shown while the record is in flight. */
export function ProfileDetailsSkeleton() {
  return (
    <Card className="rounded-2xl border-foreground/8 bg-white shadow-sm">
      <Loader label="Loading your profile…" />
    </Card>
  );
}
