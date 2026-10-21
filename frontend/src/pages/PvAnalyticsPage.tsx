import { useEffect, useState } from "react";
import { Plus, SlidersHorizontal, Target } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Loader from "../components/loading-ui/Loader";
import FormPanel from "../components/layout/FormPanel";

import AddSubscriberDrawer from "../components/pv/AddSubscriberDrawer";
import AnalyticsBreakdown from "../components/pv/AnalyticsBreakdown";
import PlaceProgressList from "../components/pv/PlaceProgressList";
import PvPageHeader from "../components/pv/PvPageHeader";
import SetTargetDrawer from "../components/pv/SetTargetDrawer";
import WorkProgressCard from "../components/pv/WorkProgressCard";
import YearSelect from "../components/pv/YearSelect";
import AnalysisFilters from "../components/pv/analysis/AnalysisFilters";
import PlacesTable from "../components/pv/analysis/PlacesTable";
import SummaryCards from "../components/pv/analysis/SummaryCards";
import { Reveal } from "../components/pv/Animated";
import { apiErrorMessage } from "../api/axios";
import { fetchAnalysisSummary, fetchPvAnalytics } from "../api/pv";
import { ANALYSIS_TABS, TAB_FILTERS, useAnalysisParams } from "../hooks/useAnalysisParams";
import type { PvAnalytics } from "../types/pv";
import type { AnalysisSummary } from "../types/pvAnalysis";

/**
 * Pravasi Vayana → Analytics. Overview: work progress for the place, then each place below it.
 * The other tabs analyse the campaign's subscriptions with shared filters, all kept in the URL.
 * Clicking a place opens its report; the trail at the top goes back up, never above the leader.
 */
function PvAnalyticsPage() {
  const { tab, filters, update, activeFilters, resetFilters } = useAnalysisParams();
  const [analytics, setAnalytics] = useState<{ key: string; data?: PvAnalytics; error?: string } | null>(null);
  const [summary, setSummary] = useState<{ key: string; data?: AnalysisSummary; error?: string } | null>(null);
  const [settingTarget, setSettingTarget] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // Bumped after a new subscriber is saved, to load the figures again.
  const [refreshKey, setRefreshKey] = useState(0);

  const overview = tab === "overview";
  const overviewKey = `${filters.year}:${filters.orgId}:${refreshKey}`;
  useEffect(() => {
    if (!overview) return;
    let current = true;
    fetchPvAnalytics({ year: filters.year, orgId: filters.orgId })
      .then((data) => current && setAnalytics({ key: overviewKey, data }))
      .catch((failure) => current && setAnalytics({ key: overviewKey, error: apiErrorMessage(failure, "Could not load the analytics.") }));
    return () => {
      current = false;
    };
    // overviewKey covers year, place and refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, overviewKey]);

  // The cards above the analysis tabs; also the years and the place's trail.
  const summaryKey = `${JSON.stringify(filters)}:${refreshKey}`;
  useEffect(() => {
    if (overview) return;
    let current = true;
    fetchAnalysisSummary(filters)
      .then((data) => current && setSummary({ key: summaryKey, data }))
      .catch((failure) => current && setSummary({ key: summaryKey, error: apiErrorMessage(failure, "Could not load the analysis.") }));
    return () => {
      current = false;
    };
    // summaryKey covers the filters and refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, summaryKey]);

  const shownAnalytics = overview && analytics?.key === overviewKey ? analytics : null;
  const shownSummary = !overview && summary?.key === summaryKey ? summary : null;
  const loaded = overview ? shownAnalytics?.data : shownSummary?.data;
  const error = overview ? shownAnalytics?.error : shownSummary?.error;
  // Kept while the next one loads, so the header does not jump.
  const scope = loaded?.scope ?? (overview ? analytics?.data?.scope : summary?.data?.scope);
  // A unit has no places below it, so the analysis tabs have nothing to compare: Overview only.
  const isUnit = scope?.place.level === "Unit";
  useEffect(() => {
    if (isUnit && !overview) update({ tab: undefined });
  }, [isUnit, overview, update]);
  const years = loaded?.years ?? [];
  const year = loaded?.year ?? null;

  function open(id: number) {
    update({ org_id: id, page: undefined });
    window.scrollTo({ top: 0 });
  }

  // The trail from the leader's own place down to the place shown.
  const path = scope?.path ?? [];
  const trail = path.slice(Math.max(0, path.findIndex((place) => place.id === scope?.top_id)));

  const filterPanel = (
    <AnalysisFilters filters={filters} shown={TAB_FILTERS[tab]} activeCount={activeFilters} onChange={update} onReset={resetFilters} />
  );

  return (
    <main className="space-y-5">
      <PvPageHeader title="Analytics" subtitle={year ? `Pravasi Vayana ${year}` : "Pravasi Vayana"}>
        <YearSelect years={years} value={year} onChange={(next) => update({ year: next })} />
        {!overview && (
          <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal />
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </Button>
        )}
        <Button onClick={() => setSettingTarget(true)}>
          <Target />
          Set Target
        </Button>
        <Button className="bg-clay text-white hover:bg-clay/90" onClick={() => setAdding(true)}>
          <Plus />
          Add New
        </Button>
      </PvPageHeader>

      <SetTargetDrawer open={settingTarget} onOpenChange={setSettingTarget} />
      <AddSubscriberDrawer open={adding} onOpenChange={setAdding} onSaved={() => setRefreshKey((value) => value + 1)} />

      {!isUnit && (
        <nav aria-label="Analysis" className="overflow-x-auto rounded-2xl bg-white p-1">
          <div className="flex min-w-max gap-1">
            {ANALYSIS_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => update({ tab: item.id })}
                className={`rounded-xl px-4 py-2 text-[13px] transition-colors ${
                  tab === item.id ? "bg-navy font-medium text-white" : "text-[#555] hover:bg-[#faf7f3]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {trail.length > 0 && (
        <nav aria-label="Report level" className="flex flex-wrap items-center gap-1 px-1 text-[13px]">
          {trail.map((place, index) => {
            const last = index === trail.length - 1;
            return (
              <span key={place.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-[#999]">•</span>}
                {last ? (
                  <span className="font-semibold text-navy">{place.name}</span>
                ) : (
                  <button type="button" onClick={() => open(place.id)} className="text-clay hover:underline">
                    {place.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {overview ? (
        <>
          {!shownAnalytics && <Loader label="Loading analytics…" className="min-h-[330px] rounded-2xl bg-white" />}
          {shownAnalytics?.data && (
            // Keyed by place and year, so drilling down or changing year plays the entrance again.
            <div key={`${shownAnalytics.data.scope.place.id}:${shownAnalytics.data.year}`} className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
                <Reveal order={0} className="[&>section]:h-full">
                  <WorkProgressCard progress={shownAnalytics.data.totals} byDay={shownAnalytics.data.by_day} />
                </Reveal>
                {/* Beside Work Progress: subscriptions by mode, with the amount under it. Amount
                    stretches so the column ends level with Work Progress. */}
                <Reveal order={1} className="flex flex-col gap-4 [&>section:last-child]:flex-1">
                  <AnalyticsBreakdown analytics={shownAnalytics.data} />
                </Reveal>
              </div>
              <Reveal order={2}>
                <PlaceProgressList
                  places={shownAnalytics.data.places}
                  onOpen={(place) => open(place.id)}
                  placeName={shownAnalytics.data.scope.place.name}
                  year={shownAnalytics.data.year}
                />
              </Reveal>
            </div>
          )}
        </>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden rounded-2xl bg-white px-4 py-5 lg:sticky lg:top-4 lg:block">{filterPanel}</aside>
          <div className="min-w-0 space-y-5">
            {shownSummary?.data ? (
              <SummaryCards summary={shownSummary.data} />
            ) : (
              !error && <Loader label="Loading…" className="min-h-[96px] rounded-2xl bg-white" />
            )}
            <PlacesTable tab={tab} filters={filters} onOpen={open} />
          </div>
        </div>
      )}

      <FormPanel open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters">
        {filterPanel}
      </FormPanel>
    </main>
  );
}

export default PvAnalyticsPage;
