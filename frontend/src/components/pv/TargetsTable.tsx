import { ChevronRight } from "lucide-react";

import StatusBadge from "./StatusBadge";
import { levelLabel } from "../../lib/pv";
import type { PvTargets, TargetStatus } from "../../types/pv";

export type TargetEdit = { print: string; digital: string };

type Row = PvTargets["children"][number];

type Props = {
  rows: Row[];
  /** The values being edited, by place id; without it the table is view-only. */
  edits?: Record<number, TargetEdit>;
  onEdit?: (id: number, edit: TargetEdit) => void;
  /** Opens a place's own allocation to the places below it. */
  onOpen: (row: Row) => void;
};

const STATUS_TONE: Record<TargetStatus, "green" | "amber" | "red"> = {
  Set: "green",
  Draft: "amber",
  "Not set": "amber",
  "Over-allocated": "red",
};

const toNumber = (value: string) => (value.trim() === "" ? 0 : Number(value));

function TargetInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-24 rounded-lg border border-[#e2d6c8] bg-white px-2 text-right text-[14px] outline-none focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30"
    />
  );
}

/** One row per place directly below: its print and digital target and status. */
function TargetsTable({ rows, edits, onEdit, onOpen }: Props) {
  if (rows.length === 0) return null;
  const heading = `${levelLabel(rows[0]?.level)}s`;

  return (
    <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
      <h2 className="px-1 text-[17px] font-semibold text-navy">
        {heading} <span className="text-[13px] font-normal text-[#6b6b6b]">({rows.length})</span>
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="text-[12px] text-[#6b6b6b]">
            <tr className="border-b border-[#ecdfd1]">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="px-2 py-2 text-right font-medium">Print Target</th>
              <th className="px-2 py-2 text-right font-medium">Digital Target</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const edit = edits?.[row.id];
              const print = edit ? toNumber(edit.print) : (row.target?.print ?? 0);
              const digital = edit ? toNumber(edit.digital) : (row.target?.digital ?? 0);
              const shown = edit || row.target;
              return (
                <tr key={row.id} className="border-b border-[#f3ebe2] last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-navy">{row.name ?? "—"}</td>
                  <td className="px-2 py-2 text-right">
                    {edit && onEdit ? (
                      <TargetInput label={`${row.name} print target`} value={edit.print} onChange={(value) => onEdit(row.id, { ...edit, print: value })} />
                    ) : shown ? (
                      print.toLocaleString()
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {edit && onEdit ? (
                      <TargetInput label={`${row.name} digital target`} value={edit.digital} onChange={(value) => onEdit(row.id, { ...edit, digital: value })} />
                    ) : shown ? (
                      digital.toLocaleString()
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-navy">{shown ? (print + digital).toLocaleString() : "—"}</td>
                  <td className="px-2 py-2">
                    <StatusBadge tone={STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                  </td>
                  <td className="py-2 text-right">
                    {row.has_children && (
                      <button
                        type="button"
                        onClick={() => onOpen(row)}
                        aria-label={`Open ${row.name}`}
                        className="grid size-8 place-items-center rounded-lg text-[#999] hover:bg-[#faf7f3] hover:text-navy"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TargetsTable;
