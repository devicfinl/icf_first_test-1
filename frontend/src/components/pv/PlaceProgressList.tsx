import { ChevronRight } from "lucide-react";

import { GrowBar } from "./Animated";
import { formatPercent, levelLabel } from "../../lib/pv";
import type { OrgPlace, PvProgress } from "../../types/pv";

// Green for high progress, as in the design; amber in between; red when far behind.
const barColor = (progress: number | null) =>
  progress === null
    ? "bg-[#cfc6bc]"
    : progress >= 0.75
      ? "bg-green-600"
      : progress >= 0.5
        ? "bg-amber-500"
        : "bg-red-500";

type Place = OrgPlace & PvProgress;

type Props = {
  places: Place[];
  onOpen: (place: OrgPlace) => void;
};

// The figures of one row, so the places and the total row read the same way.
type Figures = Pick<PvProgress, "target" | "subscriptions" | "target_print" | "print" | "target_digital" | "digital" | "paid">;

const COLUMNS: { label: string; value: (row: Figures) => number; target?: boolean }[] = [
  { label: "Total Target", value: (row) => row.target, target: true },
  { label: "Achieved", value: (row) => row.subscriptions },
  { label: "Print Target", value: (row) => row.target_print, target: true },
  { label: "Print", value: (row) => row.print },
  { label: "Digital Target", value: (row) => row.target_digital, target: true },
  { label: "Digital", value: (row) => row.digital },
  { label: "Paid", value: (row) => row.paid },
];

// A target of 0 is "not set": shown as a dash, not as 0.
const show = (value: number, target?: boolean) => (target && value === 0 ? "—" : value.toLocaleString());

function Progress({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16">
        <GrowBar share={value ?? 0} className={barColor(value)} />
      </div>
      <span className="w-14 text-right font-medium text-navy">{formatPercent(value)}</span>
    </div>
  );
}

/**
 * The places directly below the report's place in one table: each place's total, print and
 * digital target against what was achieved, and paid. Clicking a place opens its report.
 */
function PlaceProgressList({ places, onOpen }: Props) {
  if (places.length === 0) return null;
  const level = levelLabel(places[0]?.level);

  const total = places.reduce<Figures>(
    (sum, place) => ({
      target: sum.target + place.target,
      subscriptions: sum.subscriptions + place.subscriptions,
      target_print: sum.target_print + place.target_print,
      print: sum.print + place.print,
      target_digital: sum.target_digital + place.target_digital,
      digital: sum.digital + place.digital,
      paid: sum.paid + place.paid,
    }),
    { target: 0, subscriptions: 0, target_print: 0, print: 0, target_digital: 0, digital: 0, paid: 0 },
  );
  const totalProgress = total.target > 0 ? total.subscriptions / total.target : null;

  return (
    <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
      <h2 className="px-1 text-[17px] font-semibold text-navy">
        All {level}
        {places.length === 1 ? "" : "s"} <span className="text-[13px] font-normal text-[#6b6b6b]">({places.length})</span>
      </h2>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#ecdfd1]">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead className="bg-[#faf7f3] text-[12px] text-[#555]">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">#</th>
              <th className="px-3 py-2.5 text-left font-medium">{level}</th>
              {COLUMNS.map((column) => (
                <th key={column.label} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  {column.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-medium">% of Target</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {places.map((place, index) => (
              <tr
                key={place.id}
                onClick={() => onOpen(place)}
                className="cursor-pointer border-t border-[#f3ebe2] transition-colors hover:bg-[#fbf7f2]"
              >
                <td className="px-3 py-2.5 text-[#6b6b6b]">{index + 1}</td>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap text-navy">
                  {/* The button makes the row reachable by keyboard; the row click is for the mouse. */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(place);
                    }}
                    className="text-left hover:underline"
                  >
                    {place.name ?? "—"}
                  </button>
                </td>
                {COLUMNS.map((column) => (
                  <td
                    key={column.label}
                    className={`px-3 py-2.5 text-right whitespace-nowrap ${column.target ? "text-[#555]" : "font-medium text-navy"}`}
                  >
                    {show(column.value(place), column.target)}
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <Progress value={place.progress} />
                </td>
                <td className="pr-2 text-right">
                  <ChevronRight className="inline size-4 text-[#999]" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[#ecdfd1] bg-[#faf7f3] font-semibold text-navy">
            <tr>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5">Total</td>
              {COLUMNS.map((column) => (
                <td key={column.label} className="px-3 py-2.5 text-right whitespace-nowrap">
                  {show(column.value(total), column.target)}
                </td>
              ))}
              <td className="px-3 py-2.5">
                <Progress value={totalProgress} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default PlaceProgressList;
