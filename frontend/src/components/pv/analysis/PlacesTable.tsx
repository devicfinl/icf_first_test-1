import { useEffect, useState } from "react";
import { ChevronRight, Download, Share2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Loader from "../../loading-ui/Loader";
import ShareTableDialog, { type ShareView } from "../ShareTableDialog";
import { apiErrorMessage } from "../../../api/axios";
import { fetchAnalysisPlaces } from "../../../api/pv";
import { TAB_FILTERS } from "../../../hooks/useAnalysisParams";
import { downloadCsv, fileSlug } from "../../../lib/csv";
import { formatAmount, formatPercent, levelLabel } from "../../../lib/pv";
import { describeFilters } from "../../../lib/pvFilters";
import type { AnalysisFilters, AnalysisPlaces, PlaceAnalysis } from "../../../types/pvAnalysis";

export type PlacesTab = "competition" | "participation" | "payment" | "growth";

type Row = AnalysisPlaces["places"][number];

type Props = {
  tab: PlacesTab;
  filters: AnalysisFilters;
  /** Opens a place's own report. */
  onOpen: (id: number) => void;
};

// Plain text, so the same columns serve the table, the CSV and the shared message.
type Column = { key: string; label: string; value: (row: PlaceAnalysis) => string };

const count = (value: number) => value.toLocaleString();
const signed = (value: number) => (value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString());
const signedPercent = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${formatPercent(value)}`);
const amounts = (row: PlaceAnalysis, pick: "received" | "pending") =>
  row.amounts.length === 0 ? "—" : row.amounts.map((money) => formatAmount(money[pick], money.currency)).join(", ");

const COLUMNS: Record<PlacesTab, Column[]> = {
  competition: [
    { key: "target", label: "Target", value: (row) => (row.target === null ? "—" : count(row.target)) },
    { key: "subscriptions", label: "Subscriptions", value: (row) => count(row.subscriptions) },
    { key: "achieved", label: "% of target", value: (row) => formatPercent(row.achieved) },
    { key: "new", label: "New", value: (row) => count(row.new) },
    { key: "renewals", label: "Renewal", value: (row) => count(row.renewals) },
  ],
  participation: [
    { key: "units", label: "Units", value: (row) => count(row.units) },
    { key: "active", label: "With subscriptions", value: (row) => count(row.active_units) },
    { key: "without", label: "Without", value: (row) => count(row.units - row.active_units) },
    { key: "participation", label: "Participation", value: (row) => formatPercent(row.participation) },
  ],
  payment: [
    { key: "paid", label: "Paid", value: (row) => count(row.paid) },
    { key: "unpaid", label: "Not paid", value: (row) => count(row.unpaid) },
    { key: "paid_rate", label: "Paid rate", value: (row) => formatPercent(row.paid_rate) },
    { key: "received", label: "Collected", value: (row) => amounts(row, "received") },
    { key: "pending", label: "Pending", value: (row) => amounts(row, "pending") },
  ],
  growth: [
    { key: "last_year", label: "Last year", value: (row) => count(row.last_year) },
    { key: "this_year", label: "This year", value: (row) => count(row.subscriptions) },
    { key: "growth", label: "Net growth", value: (row) => signed(row.growth) },
    { key: "growth_rate", label: "Growth rate", value: (row) => signedPercent(row.growth_rate) },
  ],
};

const TAB_LABELS: Record<PlacesTab, string> = {
  competition: "Competition",
  participation: "Participation",
  payment: "Payment",
  growth: "Growth",
};

// Competition is listed by rank; the others in the order the server gives (by name).
const ordered = (tab: PlacesTab, places: Row[]) => (tab === "competition" ? [...places].sort((a, b) => a.rank - b.rank) : places);

const NOTES: Partial<Record<PlacesTab, string>> = {
  competition: "Ranked by share of the print + digital target; places without a target come last.",
  participation: "A unit takes part once it has at least one subscription matching the filters.",
  growth: "The whole campaign compared with last year's; the time range is not applied here.",
};

/** One row per place directly below the report's place; clicking one opens its report. */
function PlacesTable({ tab, filters, onOpen }: Props) {
  const [result, setResult] = useState<{ key: string; data?: AnalysisPlaces; error?: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const key = JSON.stringify(filters);

  useEffect(() => {
    let current = true;
    fetchAnalysisPlaces(filters)
      .then((data) => current && setResult({ key, data }))
      .catch((failure) => current && setResult({ key, error: apiErrorMessage(failure, "Could not load the places.") }));
    return () => {
      current = false;
    };
    // `key` covers the filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const shown = result?.key === key ? result : null;
  const data = shown?.data;
  const columns = COLUMNS[tab];
  const rows: Row[] = data ? ordered(tab, data.places) : [];
  const level = levelLabel(rows[0]?.level);
  const title = data ? `Pravasi Vayana${data.year ? ` ${data.year}` : ""} · ${data.scope.place.name ?? ""}` : "";

  // Every tab's columns are in the data, so the message can share any of them.
  const views: ShareView<PlaceAnalysis & { name?: string | null }>[] = data
    ? (Object.keys(COLUMNS) as PlacesTab[]).map((id) => ({
        id,
        label: TAB_LABELS[id],
        columns: COLUMNS[id].map((column) => ({ key: column.key, label: column.label, text: column.value })),
        rows: ordered(id, data.places),
        total: data.totals,
        order: id === "competition" ? "by % of target" : undefined,
      }))
    : [];

  function exportCsv() {
    if (!data) return;
    downloadCsv(`pravasi-vayana-${tab}-${fileSlug(data.scope.place.name ?? "places")}-${data.year ?? ""}.csv`, [
      ["#", level, ...columns.map((column) => column.label)],
      ...rows.map((row, index) => [
        String(tab === "competition" ? row.rank : index + 1),
        row.name ?? "—",
        ...columns.map((column) => column.value(row)),
      ]),
      ["", "Total", ...columns.map((column) => column.value(data.totals))],
    ]);
  }

  return (
    <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[#6b6b6b]">{NOTES[tab]}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSharing(true)} disabled={rows.length === 0}>
            <Share2 />
            Share
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            Export CSV
          </Button>
        </div>
      </div>
      <ShareTableDialog
        open={sharing}
        onOpenChange={setSharing}
        title={title}
        details={describeFilters(filters, TAB_FILTERS[tab])}
        entity={level}
        name={(row) => row.name ?? "—"}
        views={views}
        initialView={tab}
      />
      {shown?.error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{shown.error}</AlertDescription>
        </Alert>
      )}
      {!shown && <Loader label="Loading…" className="min-h-[240px]" />}
      {data && rows.length === 0 && (
        <p className="rounded-xl bg-[#faf7f3] px-4 py-8 text-center text-[14px] text-[#6b6b6b]">There are no places below this one.</p>
      )}
      {data && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#ecdfd1]">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-[#faf7f3] text-[12px] text-[#555]">
              <tr>
                <th className="px-3 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">{level}</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    {column.label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => onOpen(row.id)}
                  className="cursor-pointer border-t border-[#f3ebe2] transition-colors hover:bg-[#fbf7f2]"
                >
                  <td className="px-3 py-2.5 text-[#6b6b6b]">{tab === "competition" ? row.rank : index + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-navy">{row.name ?? "—"}</td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2.5 text-right whitespace-nowrap">
                      {column.value(row)}
                    </td>
                  ))}
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
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2.5 text-right whitespace-nowrap">
                    {/* The totals have no target, so Target and % of target show "—". */}
                    {column.value(data.totals)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default PlacesTable;
