import { RotateCcw } from "lucide-react";

import type { AnalysisParamsPatch, FilterKey } from "../../../hooks/useAnalysisParams";
import { RANGE_LABELS } from "../../../lib/pvFilters";
import type { AnalysisFilters as Filters, AnalysisRange } from "../../../types/pvAnalysis";

type Props = {
  filters: Filters;
  /** The filters this tab uses; the others are not shown. */
  shown: readonly FilterKey[];
  activeCount: number;
  onChange: (patch: AnalysisParamsPatch) => void;
  onReset: () => void;
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-2.5 py-1 text-[13px] transition-colors ${
        active ? "border-navy bg-navy text-white" : "border-[#e2d6c8] bg-white text-[#333] hover:bg-[#faf7f3]"
      }`}
    >
      {children}
    </button>
  );
}

function Group<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-medium tracking-wider text-[#555] uppercase">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([option, text]) => (
          <Chip key={option} active={value === option} onClick={() => onPick(option)}>
            {text}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

const dateInput =
  "h-9 w-full rounded-lg border border-[#e2d6c8] bg-white px-2 text-[13px] outline-none focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30";

/** The Analysis filters a tab uses: time range, category, payment and ICF member. */
function AnalysisFilters({ filters, shown, activeCount, onChange, onReset }: Props) {
  const has = (key: FilterKey) => shown.includes(key);
  return (
    <div className="space-y-5">
      <p className="text-[12px] font-semibold tracking-wider text-navy uppercase">
        Filters{activeCount > 0 && <span className="ml-1 font-normal text-clay">({activeCount} active)</span>}
      </p>

      {has("range") && (
        <Group
          label="Date & time"
          value={filters.range}
          options={Object.entries(RANGE_LABELS) as [AnalysisRange, string][]}
          onPick={(range) => onChange({ range })}
        />
      )}
      {has("range") && filters.range === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12px] text-[#555]">
            From
            <input type="date" className={dateInput} value={filters.from ?? ""} max={filters.to} onChange={(event) => onChange({ from: event.target.value })} />
          </label>
          <label className="text-[12px] text-[#555]">
            To
            <input type="date" className={dateInput} value={filters.to ?? ""} min={filters.from} onChange={(event) => onChange({ to: event.target.value })} />
          </label>
        </div>
      )}

      {has("category") && (
        <Group
          label="Category"
          value={filters.category}
          options={[["all", "All"], ["new", "New"], ["renew", "Renewal"]]}
          onPick={(category) => onChange({ category })}
        />
      )}
      {has("payment") && (
        <Group
          label="Payment"
          value={filters.payment}
          options={[["all", "All"], ["paid", "Paid"], ["unpaid", "Not paid"]]}
          onPick={(payment) => onChange({ payment })}
        />
      )}
      {has("member") && (
        <Group
          label="ICF member"
          value={filters.member}
          options={[["all", "All"], ["yes", "Member"], ["no", "Non-member"]]}
          onPick={(member) => onChange({ member })}
        />
      )}

      <button
        type="button"
        onClick={onReset}
        disabled={activeCount === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e2d6c8] bg-white py-2 text-[14px] text-navy hover:bg-[#faf7f3] disabled:opacity-50"
      >
        <RotateCcw className="size-4" />
        Reset filters
      </button>
    </div>
  );
}

export default AnalysisFilters;
