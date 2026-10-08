import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import Loader from "../components/loading-ui/Loader";

import AnalyticsBreakdown from "../components/pv/AnalyticsBreakdown";
import PlaceProgressList from "../components/pv/PlaceProgressList";
import ProgressDetails from "../components/pv/ProgressDetails";
import PvPageHeader from "../components/pv/PvPageHeader";
import WorkProgressCard from "../components/pv/WorkProgressCard";
import YearSelect from "../components/pv/YearSelect";
import { Reveal } from "../components/pv/Animated";
import { apiErrorMessage } from "../api/axios";
import { fetchPvAnalytics } from "../api/pv";
import type { PvAnalytics } from "../types/pv";

/**
 * Pravasi Vayana → Analytics: work progress for the leader's place, then each place below it.
 * Clicking a place opens its report; the trail at the top goes back up, never above the leader.
 */
function PvAnalyticsPage() {
  const [year, setYear] = useState<number | undefined>(undefined);
  // undefined: the leader's own place.
  const [orgId, setOrgId] = useState<number | undefined>(undefined);
  const [analytics, setAnalytics] = useState<PvAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchPvAnalytics({ year, orgId })
      .then((loaded) => {
        if (!current) return;
        setAnalytics(loaded);
        setError(null);
      })
      .catch((failure) => current && setError(apiErrorMessage(failure, "Could not load the analytics.")));
    return () => {
      current = false;
    };
  }, [year, orgId]);

  function open(id: number) {
    setOrgId(id);
    window.scrollTo({ top: 0 });
  }

  // The trail from the leader's own place down to the place shown.
  const path = analytics?.scope.path ?? [];
  const trail = path.slice(Math.max(0, path.findIndex((place) => place.id === analytics?.scope.top_id)));

  return (
    <main className="space-y-5">
      <PvPageHeader
        title="Analytics"
        subtitle={analytics?.year ? `Pravasi Vayana ${analytics.year}` : "Pravasi Vayana"}
      >
        <YearSelect years={analytics?.years ?? []} value={analytics?.year ?? null} onChange={setYear} />
      </PvPageHeader>

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

      {!analytics && !error && <Loader label="Loading analytics…" className="min-h-[330px] rounded-2xl bg-white" />}

      {analytics && (
        // Keyed by place and year, so drilling down or changing year plays the entrance again.
        <div key={`${analytics.scope.place.id}:${analytics.year}`} className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <Reveal order={0} className="[&>section]:h-full">
              <WorkProgressCard progress={analytics.totals} />
            </Reveal>
            <Reveal order={1} className="[&>section]:h-full">
              <ProgressDetails progress={analytics.totals} />
            </Reveal>
          </div>
          <Reveal order={2} className="grid gap-4 md:grid-cols-2">
            <AnalyticsBreakdown analytics={analytics} />
          </Reveal>
          <Reveal order={3}>
            <PlaceProgressList places={analytics.places} onOpen={(place) => open(place.id)} />
          </Reveal>
        </div>
      )}
    </main>
  );
}

export default PvAnalyticsPage;
