import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import AddSubscriberDrawer from "../components/pv/AddSubscriberDrawer";
import PvPageHeader from "../components/pv/PvPageHeader";
import StatusBadge from "../components/pv/StatusBadge";
import TablePager from "../components/pv/TablePager";
import { apiErrorMessage } from "../api/axios";
import { fetchRenewals } from "../api/pv";
import { clickableRowClass, onRowClick, subscriberPath } from "../lib/rowLink";
import { formatMobile, modeLabel } from "../lib/pv";
import type { ExistingSubscriber, RenewalPage } from "../types/pv";
import Loader from "../components/loading-ui/Loader";

const PAGE_SIZE = 10;
const COLUMNS = ["No.", "Name", "Mobile", "Ledger No.", "Unit", "Last subscription", "Status", ""];
const FILTERS = [
  { value: "all", label: "All" },
  { value: "renew", label: "To renew" },
  { value: "renewed", label: "Renewed" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/**
 * Pravasi Vayana → Renew Subscriber: last year's subscribers in the leader's branch. Renew opens
 * the form in a drawer, filled from their last subscription (unit included).
 */
function PvRenewPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [renewing, setRenewing] = useState<ExistingSubscriber | null>(null);

  const [data, setData] = useState<RenewalPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listKey = `${status}:${search}:${page}:${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== listKey;

  useEffect(() => {
    let current = true;
    fetchRenewals({ status, search, page, pageSize: PAGE_SIZE })
      .then((loaded) => {
        if (!current) return;
        setData(loaded);
        setError(null);
      })
      .catch((failure) => current && setError(apiErrorMessage(failure, "Could not load the renew list.")))
      .finally(() => current && setLoadedKey(listKey));
    return () => {
      current = false;
    };
  }, [status, search, page, refreshKey, listKey]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function chooseFilter(value: Filter) {
    setStatus(value);
    setPage(1);
  }

  const items = data?.items ?? [];
  const from = data && data.total > 0 ? (data.page - 1) * data.page_size + 1 : 0;

  return (
    <main className="space-y-5">
      <PvPageHeader
        title="Renew Subscribers"
        subtitle={data?.year ? `Last year's subscribers, to renew for ${data.year}` : "Last year's subscribers"}
      />

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="rounded-2xl bg-white px-4 pt-6 pb-8 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2" role="tablist" aria-label="Status">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={status === filter.value}
                onClick={() => chooseFilter(filter.value)}
                className={`rounded-full px-4 py-1.5 text-[13px] ${status === filter.value ? "bg-navy text-white" : "bg-[#f3ebe2] text-[#555] hover:bg-[#ecdfd1]"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <form onSubmit={submitSearch} className="flex gap-2 md:w-[360px]">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, mobile or ledger no."
              aria-label="Search"
              className="h-10"
            />
            <Button type="submit" variant="outline" className="h-10 rounded-full" aria-label="Search">
              <Search />
            </Button>
          </form>
        </div>

        <div className={`mt-5 overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-[#f3ebe2] text-[12px] font-medium text-[#555]">
                {COLUMNS.map((column, index) => (
                  <th key={index} scope="col" className="px-2.5 py-3.5 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#333]">
              {items.map((row, index) => (
                <tr
                  key={row.subscriber_id}
                  className={clickableRowClass}
                  onClick={onRowClick(() => navigate(subscriberPath(row.subscriber_id, row.previous.year)))}
                >
                  <td className="px-2.5 py-3">{from + index}</td>
                  <td className="px-2.5 py-3 font-medium text-navy">
                    <Link to={subscriberPath(row.subscriber_id, row.previous.year)} className="hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-2.5 py-3 whitespace-nowrap">{formatMobile(row.mobile_country, row.mobile)}</td>
                  <td className="px-2.5 py-3">{row.ledger_no ?? "—"}</td>
                  <td className="px-2.5 py-3">{row.previous.unit.name ?? "—"}</td>
                  <td className="px-2.5 py-3 whitespace-nowrap">
                    {modeLabel(row.previous.subscription_mode)} {row.previous.year ?? ""}
                  </td>
                  <td className="px-2.5 py-3">
                    {row.already_registered_this_year ? (
                      <StatusBadge tone="green">Renewed</StatusBadge>
                    ) : (
                      <StatusBadge tone="amber">Renew</StatusBadge>
                    )}
                  </td>
                  <td className="px-2.5 py-3 text-right">
                    {!row.already_registered_this_year && (
                      <Button size="sm" className="rounded-full" onClick={() => setRenewing(row)}>
                        <RefreshCw />
                        Renew
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p className="border-b border-[#e7e1da] px-2.5 py-10 text-center text-[14px] text-[#6b6b6b]">
            {loading ? <Loader variant="inline" /> : search ? "No subscriber matches that search." : "No subscribers to show."}
          </p>
        )}

        <TablePager
          page={data?.page ?? 1}
          pageSize={data?.page_size ?? PAGE_SIZE}
          total={data?.total ?? 0}
          loading={loading}
          onPageChange={setPage}
        />
      </section>

      <AddSubscriberDrawer
        key={renewing?.subscriber_id ?? "none"}
        open={renewing !== null}
        renew={renewing ?? undefined}
        onOpenChange={(open) => !open && setRenewing(null)}
        onSaved={() => setRefreshKey((key) => key + 1)}
      />
    </main>
  );
}

export default PvRenewPage;
