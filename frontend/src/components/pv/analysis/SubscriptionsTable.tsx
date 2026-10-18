import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Columns3, Download, Search, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import Loader from "../../loading-ui/Loader";
import ShareTableDialog from "../ShareTableDialog";
import StatusBadge from "../StatusBadge";
import TablePager from "../TablePager";
import { apiErrorMessage } from "../../../api/axios";
import { fetchAnalysisSubscriptions } from "../../../api/pv";
import { downloadCsv } from "../../../lib/csv";
import { formatAmount, formatMobile, modeLabel, titleCase } from "../../../lib/pv";
import { describeFilters } from "../../../lib/pvFilters";
import { clickableRowClass, onRowClick, subscriberPath } from "../../../lib/rowLink";
import type { OrgPlace } from "../../../types/pv";
import type { AnalysisFilters, AnalysisSubscription, AnalysisSubscriptionPage, SubscriptionSort } from "../../../types/pvAnalysis";

type Tab = "all" | "new" | "old";

type Props = {
  tab: Tab;
  filters: AnalysisFilters;
  sort: SubscriptionSort;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  onChange: (patch: { sort?: string; dir?: string; page?: number; page_size?: number; search?: string }) => void;
};

/** A row with every place above its unit, from the country down (the report's trail, then `under`). */
type Row = AnalysisSubscription & { places: OrgPlace[] };

const withPlaces = (page: AnalysisSubscriptionPage): Row[] =>
  page.rows.map((row) => ({ ...row, places: [...page.scope.path, ...row.under] }));

type Column = {
  key: string;
  label: string;
  sort?: SubscriptionSort;
  /** Shown until the leader changes the columns. */
  shown: boolean;
  /** Only on the Old Subscribers tab. */
  oldOnly?: boolean;
  align?: "right";
  /** A place column (e.g. Region), and whether it shows only when a row has that level (Chapter). */
  level?: { name: string; onlyIfPresent?: boolean };
  /** Plain text, for the download. */
  text: (row: Row) => string;
  cell?: (row: Row) => ReactNode;
};

const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
const money = (row: Row) =>
  row.amount === null ? "—" : row.currency ? formatAmount(row.amount, row.currency) : String(row.amount);

// The row's place at a level (National is the country), e.g. its Region.
const placeColumn = (key: string, label: string, name: string, onlyIfPresent = false): Column => ({
  key,
  label,
  shown: true,
  level: { name, onlyIfPresent },
  text: (row) => row.places.find((place) => place.level === name)?.name ?? "—",
});

// The place columns, which replaced the single "Under" column.
const PLACE_KEYS = ["country", "chapter", "region", "division"];
// From the top down. A place column at or above the leader's own level is the same on every row: hidden.
const LEVEL_ORDER = ["International", "National", "Chapter", "Region", "Division", "Unit"];

const COLUMNS: Column[] = [
  placeColumn("country", "Country", "National"),
  // Only some countries (e.g. Saudi) have a Chapter level.
  placeColumn("chapter", "Chapter", "Chapter", true),
  placeColumn("region", "Region", "Region"),
  placeColumn("division", "Division", "Division"),
  { key: "unit", label: "Unit", shown: true, text: (row) => row.unit.name ?? "—" },
  { key: "name", label: "Subscriber", sort: "name", shown: true, text: (row) => row.name },
  { key: "mobile", label: "Mobile", shown: true, text: (row) => formatMobile(row.mobile_country, row.mobile) },
  { key: "mode", label: "Subscription", sort: "mode", shown: true, text: (row) => modeLabel(row.subscription_mode) },
  { key: "member", label: "ICF Member", shown: true, text: (row) => row.is_icf_member ?? "—" },
  { key: "membership_id", label: "Membership ID", shown: true, text: (row) => row.membership_id ?? "—" },
  {
    key: "category",
    label: "Category",
    sort: "category",
    shown: true,
    text: (row) => (row.registration_type === "RENEW" ? "Renewal" : "New"),
    cell: (row) =>
      row.registration_type === "RENEW" ? <StatusBadge tone="green">Renewal</StatusBadge> : <StatusBadge tone="amber">New</StatusBadge>,
  },
  {
    key: "renewed",
    label: "Renewed this year",
    shown: true,
    oldOnly: true,
    text: (row) => (row.renewed ? "Yes" : "No"),
    cell: (row) => (row.renewed ? <StatusBadge tone="green">Renewed</StatusBadge> : <StatusBadge tone="red">Not yet</StatusBadge>),
  },
  { key: "status", label: "Approval", shown: false, text: (row) => titleCase(row.approval_status) },
  {
    key: "payment",
    label: "Payment",
    shown: true,
    text: (row) => (row.paid ? "Paid" : "Not paid"),
    cell: (row) => (row.paid ? <StatusBadge tone="green">Paid</StatusBadge> : <StatusBadge tone="red">Not paid</StatusBadge>),
  },
  { key: "amount", label: "Amount", sort: "amount", shown: true, align: "right", text: money },
  { key: "ledger", label: "Ledger No", shown: false, text: (row) => row.ledger_no ?? "—" },
  { key: "added_by", label: "Collected by", shown: true, text: (row) => row.added_by ?? "—" },
  { key: "created_at", label: "Created", sort: "created_at", shown: true, text: (row) => dateTime(row.created_at) },
  { key: "updated_at", label: "Last updated", sort: "updated_at", shown: false, text: (row) => dateTime(row.updated_at) },
];

const STORAGE_KEY = "pv-analysis-columns";
const defaultColumns = () => COLUMNS.filter((column) => column.shown).map((column) => column.key);

// The leader's chosen columns, kept in this browser only.
function savedColumns(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(saved) && saved.every((key) => typeof key === "string")) {
      // Saved before the place columns: "Under" becomes Country, Chapter, Region and Division.
      const keys = saved.flatMap((key) => (key === "under" ? PLACE_KEYS : [key]));
      // Saved before the Membership ID column: shown after ICF Member.
      return keys.includes("member") && !keys.includes("membership_id")
        ? keys.flatMap((key) => (key === "member" ? [key, "membership_id"] : [key]))
        : keys;
    }
  } catch {
    // Storage blocked or unreadable: the defaults.
  }
  return defaultColumns();
}

function saveColumns(keys: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Not saved; they still apply until the page is reloaded.
  }
}

// Ticked in the shared message when it opens: enough to read, without contact details.
const SHARE_COLUMNS = ["unit", "name", "mode", "category", "payment", "amount"];

/** The subscriptions for the filters: All, New Subscribers, or last year's (Old Subscribers). */
function SubscriptionsTable({ tab, filters, sort, dir, page, pageSize, onChange }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState<string[]>(savedColumns);
  const [result, setResult] = useState<{ key: string; data?: AnalysisSubscriptionPage; error?: string } | null>(null);
  const urlSearch = filters.search ?? "";
  const [search, setSearch] = useState(urlSearch);
  // The last value this box put in the URL, and the URL value last seen: a change that did not come
  // from here (Reset filters, back button) replaces what is typed.
  const [sent, setSent] = useState(urlSearch);
  const [seen, setSeen] = useState(urlSearch);
  if (urlSearch !== seen) {
    setSeen(urlSearch);
    if (urlSearch !== sent) {
      setSearch(urlSearch);
      setSent(urlSearch);
    }
  }
  const [exporting, setExporting] = useState(false);
  // Every row for the filters, loaded when Share is pressed; the dialog is open while it is set.
  const [shareRows, setShareRows] = useState<Row[] | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);

  const key = JSON.stringify({ tab, filters, sort, dir, page, pageSize });
  useEffect(() => {
    let current = true;
    fetchAnalysisSubscriptions(filters, { tab, sort, dir, page, pageSize })
      .then((data) => current && setResult({ key, data }))
      .catch((failure) => current && setResult({ key, error: apiErrorMessage(failure, "Could not load the subscriptions.") }));
    return () => {
      current = false;
    };
    // `key` covers every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Typing settles for a moment before the list is asked again.
  useEffect(() => {
    const value = search.trim();
    if (value === urlSearch) return;
    const timer = setTimeout(() => {
      setSent(value);
      onChange({ search: value || undefined });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, urlSearch, onChange]);

  const shown = result?.key === key ? result : null;
  const data = shown?.data;
  const rows = data ? withPlaces(data) : [];
  // The leader's own level: place columns at or above it are left out (a Region leader sees no Region).
  const ownLevel = LEVEL_ORDER.indexOf(data?.scope.path.find((place) => place.id === data.scope.top_id)?.level ?? "");
  // A Chapter column shows only when some row has a Chapter.
  const present = (column: Column, list: Row[]) =>
    !column.level ||
    (LEVEL_ORDER.indexOf(column.level.name) > ownLevel &&
      (!column.level.onlyIfPresent || list.some((row) => row.places.some((place) => place.level === column.level!.name))));
  const choosable = COLUMNS.filter((column) => (!column.oldOnly || tab === "old") && present(column, rows));
  const columns = choosable.filter((column) => visible.includes(column.key));
  const yearShown = tab === "old" && data?.year ? data.year - 1 : data?.year;

  function choose(keys: string[]) {
    setVisible(keys);
    saveColumns(keys);
  }

  function toggleSort(column: Column) {
    if (!column.sort) return;
    if (sort === column.sort) onChange({ dir: dir === "asc" ? "desc" : "asc" });
    else onChange({ sort: column.sort, dir: column.sort === "name" ? "asc" : "desc" });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await fetchAnalysisSubscriptions(filters, { tab, sort, dir, page: 1, pageSize, exportAll: true });
      const allRows = withPlaces(all);
      const exported = COLUMNS.filter((column) => (!column.oldOnly || tab === "old") && present(column, allRows) && visible.includes(column.key));
      downloadCsv(`pravasi-vayana-${tab}-${yearShown ?? "subscriptions"}.csv`, [
        ["Sl No", ...exported.map((column) => column.label)],
        ...allRows.map((row, index) => [String(index + 1), ...exported.map((column) => column.text(row))]),
      ]);
      if (all.total > all.rows.length) toast.warning(`Only the first ${all.rows.length.toLocaleString()} rows were downloaded.`);
    } catch (failure) {
      toast.error(apiErrorMessage(failure, "Could not download the list."));
    } finally {
      setExporting(false);
    }
  }

  async function openShare() {
    setLoadingShare(true);
    try {
      const all = await fetchAnalysisSubscriptions(filters, { tab, sort, dir, page: 1, pageSize, exportAll: true });
      if (all.total > all.rows.length) toast.warning(`Only the first ${all.rows.length.toLocaleString()} rows can be shared.`);
      setShareRows(withPlaces(all));
    } catch (failure) {
      toast.error(apiErrorMessage(failure, "Could not load the list to share."));
    } finally {
      setLoadingShare(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
      {data && (
        <ShareTableDialog<Row>
          open={shareRows !== null}
          onOpenChange={(open) => !open && setShareRows(null)}
          title={`Pravasi Vayana${yearShown ? ` ${yearShown}` : ""} · ${data.scope.place.name ?? ""}`}
          details={describeFilters(filters, ["search"])}
          entity="Subscriber"
          countWord="First"
          name={(row) => row.name}
          views={[
            {
              id: "subscribers",
              label: "Subscribers",
              // The name is the start of each line, so it is not a column here.
              columns: COLUMNS.filter((column) => (!column.oldOnly || tab === "old") && present(column, shareRows ?? []))
                .filter((column) => column.key !== "name")
                .map((column) => ({ key: column.key, label: column.label, text: column.text, shown: SHARE_COLUMNS.includes(column.key) })),
              rows: shareRows ?? [],
            },
          ]}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#999]" />
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, mobile, ledger or subscriber no."
            className="h-10 w-full rounded-lg border border-[#e2d6c8] pr-3 pl-9 text-[14px] outline-none focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3 />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {choosable.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visible.includes(column.key)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    choose(checked ? COLUMNS.map((c) => c.key).filter((k) => k === column.key || visible.includes(k)) : visible.filter((k) => k !== column.key))
                  }
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => choose(COLUMNS.map((column) => column.key))}>Select all</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => choose(defaultColumns())}>Reset to default</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={openShare} disabled={loadingShare || !data || data.total === 0}>
            <Share2 />
            {loadingShare ? "Loading…" : "Share"}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={exporting || !data || data.total === 0}>
            <Download />
            {exporting ? "Preparing…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {tab === "old" && yearShown && (
        <p className="mt-3 text-[13px] text-[#6b6b6b]">Subscribers of {yearShown}, and whether they have renewed for {data?.year}.</p>
      )}

      {shown?.error && (
        <Alert variant="destructive" className="mt-4 rounded-xl">
          <AlertDescription>{shown.error}</AlertDescription>
        </Alert>
      )}
      {!shown && <Loader label="Loading subscriptions…" className="mt-4 min-h-[240px]" />}

      {data && data.rows.length === 0 && (
        <p className="mt-6 rounded-xl bg-[#faf7f3] px-4 py-8 text-center text-[14px] text-[#6b6b6b]">
          No subscriptions match these filters.
        </p>
      )}

      {data && rows.length > 0 && (
        <>
          <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-[#ecdfd1]">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-[#faf7f3] text-[12px] text-[#555]">
                <tr>
                  <th className="px-3 py-2.5 font-medium">#</th>
                  {columns.map((column) => (
                    <th key={column.key} className={`px-3 py-2.5 font-medium whitespace-nowrap ${column.align === "right" ? "text-right" : ""}`}>
                      {column.sort ? (
                        <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 hover:text-navy">
                          {column.label}
                          {sort === column.sort && (dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.subscriber_id}-${row.year}`}
                    className={clickableRowClass}
                    onClick={onRowClick(() => navigate(subscriberPath(row.subscriber_id, row.year)))}
                  >
                    <td className="px-3 py-2.5 text-[#6b6b6b]">{(data.page - 1) * data.page_size + index + 1}</td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-3 py-2.5 whitespace-nowrap ${column.key === "name" ? "font-medium text-navy" : ""} ${column.align === "right" ? "text-right" : ""}`}
                      >
                        {column.cell ? column.cell(row) : column.text(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex-1">
              <TablePager page={data.page} pageSize={data.page_size} total={data.total} loading={false} onPageChange={(next) => onChange({ page: next })} />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[#555]">
              Rows
              <NativeSelect value={pageSize} onChange={(event) => onChange({ page_size: Number(event.target.value) })} className="[&_select]:h-8">
                {[25, 50, 100].map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {size}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </div>
        </>
      )}
    </section>
  );
}

export default SubscriptionsTable;
