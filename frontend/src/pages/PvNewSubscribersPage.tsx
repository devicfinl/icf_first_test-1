import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

import AddSubscriberDrawer from "../components/pv/AddSubscriberDrawer";
import NewRegistrationsTable from "../components/pv/NewRegistrationsTable";
import YearSelect from "../components/pv/YearSelect";
import { apiErrorMessage } from "../api/axios";
import { fetchRegistrations } from "../api/pv";
import type { RegistrationPage } from "../types/pv";

const PAGE_SIZE = 10;

/**
 * Pravasi Vayana → New Subscriber: the approved new subscribers in the leader's branch. Add New
 * opens the subscriber form in a drawer; saving refreshes the list.
 */
function PvNewSubscribersPage() {
  // undefined: the latest year that has subscriptions (the server picks it).
  const [year, setYear] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  // Bumped after a save, to load the list again.
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [registrations, setRegistrations] = useState<RegistrationPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The list is loading until the request for the current year/page/refresh has finished.
  const listKey = `${year}:${page}:${refreshKey}`;
  const [loadedListKey, setLoadedListKey] = useState<string | null>(null);
  const listLoading = loadedListKey !== listKey;

  useEffect(() => {
    let current = true;
    fetchRegistrations({ year, page, pageSize: PAGE_SIZE })
      .then((loaded) => {
        if (!current) return;
        setRegistrations(loaded);
        setError(null);
      })
      .catch((failure) => current && setError(apiErrorMessage(failure, "Could not load the subscribers.")))
      .finally(() => current && setLoadedListKey(listKey));
    return () => {
      current = false;
    };
  }, [year, page, refreshKey, listKey]);

  function chooseYear(value: number) {
    setYear(value);
    setPage(1);
  }

  function onSaved() {
    setPage(1);
    setRefreshKey((key) => key + 1);
  }

  return (
    <main className="space-y-5">

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* One card: the title row and the table together. */}
      <NewRegistrationsTable
        data={registrations}
        loading={listLoading}
        onPageChange={setPage}
        header={
          <div className="flex flex-wrap items-center justify-between gap-4 px-1">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-navy">New Subscribers</h1>
              <p className="text-[16px] text-[#6b6b6b]">
                {registrations?.year ? `Subscribers ${registrations.year}` : "Subscribers for the current year"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <YearSelect years={registrations?.years ?? []} value={registrations?.year ?? null} onChange={chooseYear} />
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
        }
      />

      <AddSubscriberDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onSaved={onSaved} />
    </main>
  );
}

export default PvNewSubscribersPage;
