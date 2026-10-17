import { useState } from "react";
import { ChevronRight, Download, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GrowBar } from "./Animated";
import ShareTableDialog, { type ShareColumn } from "./ShareTableDialog";
import { downloadCsv, fileSlug } from "../../lib/csv";
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
  /** The report's place and year, for the shared message and the file name. */
  placeName: string | null;
  year: number | null;
};

// The figures of one row, so the places and the total row read the same way.
type Figures = Pick<PvProgress, "target" | "subscriptions" | "target_print" | "print" | "target_digital" | "digital" | "paid">;

const COLUMNS: { key: string; label: string; value: (row: Figures) => number; target?: boolean }[] = [
  { key: "target", label: "Total Target", value: (row) => row.target, target: true },
  { key: "achieved", label: "Achieved", value: (row) => row.subscriptions },
  { key: "target_print", label: "Print Target", value: (row) => row.target_print, target: true },
  { key: "print", label: "Print", value: (row) => row.print },
  { key: "target_digital", label: "Digital Target", value: (row) => row.target_digital, target: true },
  { key: "digital", label: "Digital", value: (row) => row.digital },
  { key: "paid", label: "Paid", value: (row) => row.paid },
];

const share = (row: Figures) => (row.target > 0 ? row.subscriptions / row.target : null);

// The table's columns as text, then % of target: for the CSV and the shared message.
const TEXT_COLUMNS: ShareColumn<Figures>[] = [
  ...COLUMNS.map((column) => ({ key: column.key, label: column.label, text: (row: Figures) => show(column.value(row), column.target) })),
  { key: "progress", label: "% of Target", text: (row) => formatPercent(share(row)) },
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
function PlaceProgressList({ places, onOpen, placeName, year }: Props) {
  const [sharing, setSharing] = useState(false);
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
  const totalProgress = share(total);
  const name = (row: Figures) => (row as Place).name ?? "—";

  function exportCsv() {
    downloadCsv(`pravasi-vayana-progress-${fileSlug(placeName ?? "places")}-${year ?? ""}.csv`, [
      ["#", level, ...TEXT_COLUMNS.map((column) => column.label)],
      ...places.map((place, index) => [String(index + 1), name(place), ...TEXT_COLUMNS.map((column) => column.text(place))]),
      ["", "Total", ...TEXT_COLUMNS.map((column) => column.text(total))],
    ]);
  }

  return (
    <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="px-1 text-[17px] font-semibold text-navy">
          All {level}
          {places.length === 1 ? "" : "s"} <span className="text-[13px] font-normal text-[#6b6b6b]">({places.length})</span>
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSharing(true)}>
            <Share2 />
            Share
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download />
            Export CSV
          </Button>
        </div>
      </div>
      <ShareTableDialog<Figures>
        open={sharing}
        onOpenChange={setSharing}
        title={`Pravasi Vayana${year ? ` ${year}` : ""} · ${placeName ?? ""}`}
        details={[]}
        entity={level}
        name={name}
        views={[{ id: "progress", label: "Work progress", columns: TEXT_COLUMNS, rows: places, total }]}
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#ecdfd1]">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead className="bg-[#faf7f3] text-[12px] text-[#555]">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">#</th>
              <th className="px-3 py-2.5 text-left font-medium">{level}</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
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
                    key={column.key}
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
                <td key={column.key} className="px-3 py-2.5 text-right whitespace-nowrap">
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
