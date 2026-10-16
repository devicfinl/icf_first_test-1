import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

import AddSubscriberDrawer from "../components/pv/AddSubscriberDrawer";
import YearSelect from "../components/pv/YearSelect";
import HierarchyFilter from "../components/pv/analysis/HierarchyFilter";
import SubscriptionsTable from "../components/pv/analysis/SubscriptionsTable";
import SummaryCards from "../components/pv/analysis/SummaryCards";
import { apiErrorMessage } from "../api/axios";
import { fetchAnalysisSummary } from "../api/pv";
import { useAnalysisParams } from "../hooks/useAnalysisParams";
import type { AnalysisSummary } from "../types/pvAnalysis";

/**
 * Pravasi Vayana → Subscribers: this year's subscriptions in the leader's branch, in the same
 * table as Analytics → All, narrowed by place one level at a time (all by default). The year,
 * place, sort and page are kept in the URL. Add New opens the subscriber form in a drawer.
 */
function PvNewSubscribersPage() {
  const { filters, sort, dir, page, pageSize, update } = useAnalysisParams();
  // Bumped after a save, to load the cards and the list again.
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summary, setSummary] = useState<{ key: string; data?: AnalysisSummary; error?: string } | null>(null);

  const key = `${JSON.stringify(filters)}:${refreshKey}`;
  useEffect(() => {
    let current = true;
    fetchAnalysisSummary(filters)
      .then((data) => current && setSummary({ key, data }))
      .catch((failure) => current && setSummary({ key, error: apiErrorMessage(failure, "Could not load the subscribers.") }));
    return () => {
      current = false;
    };
    // `key` covers the filters and refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const shown = summary?.key === key ? summary : null;
  // Kept while the next one loads, so the dropdowns and year do not jump.
  const data = shown?.data ?? summary?.data;
  const scope = data?.scope;
  // The chosen places below the leader's own (the path runs from the country down).
  const below = scope ? scope.path.slice(scope.path.findIndex((place) => place.id === scope.top_id) + 1) : [];

  function onSaved() {
    update({ page: undefined });
    setRefreshKey((value) => value + 1);
  }

  return (
    <main className="space-y-5">
      <section className="space-y-4 rounded-2xl bg-white px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 px-1">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold text-navy">Subscribers</h1>
            <p className="text-[16px] text-[#6b6b6b]">
              {data?.year ? `Subscribers ${data.year}` : "Subscribers for the current year"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <YearSelect years={data?.years ?? []} value={data?.year ?? null} onChange={(year) => update({ year })} />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="New subscriber"
              title="New subscriber"
              className=" flex column-flex place-items-center  bg-clay p-2 rounded-sm text-white shadow-md transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-navy/40 focus-visible:outline-none motion-reduce:transform-none"
            >
              <Plus className="size-5" /> Add New
            </button>
          </div>
        </div>

        {/* A Unit leader has no places below, so no dropdowns show. */}
        {scope && <HierarchyFilter rootId={scope.top_id} path={below} onChange={(orgId) => update({ org_id: orgId })} />}

        {/* Each count against its base, with a progress line, in the same section as the filters. */}
        {data && <SummaryCards summary={data} against inset />}
      </section>

      {shown?.error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{shown.error}</AlertDescription>
        </Alert>
      )}


      <SubscriptionsTable
        key={refreshKey}
        tab="all"
        filters={filters}
        sort={sort}
        dir={dir}
        page={page}
        pageSize={pageSize}
        onChange={update}
      />

      <AddSubscriberDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onSaved={onSaved} />
    </main>
  );
}

export default PvNewSubscribersPage;
