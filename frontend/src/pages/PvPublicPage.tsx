import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import PublicLinkCard from "../components/pv/PublicLinkCard";
import PvPageHeader from "../components/pv/PvPageHeader";
import RejectDialog from "../components/pv/RejectDialog";
import StatusBadge from "../components/pv/StatusBadge";
import TablePager from "../components/pv/TablePager";
import { apiErrorMessage } from "../api/axios";
import { approvePublicRegistration, fetchPublicRegistrations, rejectPublicRegistration } from "../api/pv";
import { formatAmount, formatDate, formatMobile, modeLabel } from "../lib/pv";
import { clickableRowClass, onRowClick, subscriberPath } from "../lib/rowLink";
import { useAppContext } from "../context/AppContext";
import type { PublicRegistration, PublicRegistrationPage, PublicStatus } from "../types/pv";
import Loader from "../components/loading-ui/Loader";

const PAGE_SIZE = 10;
const TABS: { value: PublicStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];
const TONE = { PENDING: "amber", APPROVED: "green", REJECTED: "red" } as const;

/**
 * Pravasi Vayana → Public Subscription: the leader's public link to share, and the registrations
 * that came through public links in their branch, to approve or reject.
 */
function PvPublicPage() {
  const navigate = useNavigate();
  const { session } = useAppContext();

  const [status, setStatus] = useState<PublicStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rejecting, setRejecting] = useState<PublicRegistration | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const [data, setData] = useState<PublicRegistrationPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listKey = `${status}:${page}:${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== listKey;

  useEffect(() => {
    let current = true;
    fetchPublicRegistrations({ status, page, pageSize: PAGE_SIZE })
      .then((loaded) => {
        if (!current) return;
        setData(loaded);
        setError(null);
      })
      .catch((failure) => current && setError(apiErrorMessage(failure, "Could not load the public registrations.")))
      .finally(() => current && setLoadedKey(listKey));
    return () => {
      current = false;
    };
  }, [status, page, refreshKey, listKey]);

  function chooseTab(value: PublicStatus) {
    setStatus(value);
    setPage(1);
  }

  async function approve(row: PublicRegistration) {
    setApprovingId(row.subscriber_id);
    try {
      await approvePublicRegistration(row.subscriber_id);
      toast.success(`${row.name} approved`);
      setRefreshKey((key) => key + 1);
    } catch (failure) {
      toast.error(apiErrorMessage(failure, "Could not approve. Please try again."));
    } finally {
      setApprovingId(null);
    }
  }

  async function reject(reason: string) {
    if (!rejecting) return;
    try {
      await rejectPublicRegistration(rejecting.subscriber_id, reason);
      toast.success(`${rejecting.name} rejected`);
      setRejecting(null);
      setRefreshKey((key) => key + 1);
    } catch (failure) {
      toast.error(apiErrorMessage(failure, "Could not reject. Please try again."));
    }
  }

  const items = data?.items ?? [];
  const pending = status === "PENDING";
  const columns = ["Name", "Mobile", "Unit", "Mode", "Amount", "Address", "Received on", pending ? "" : "Status"];

  return (
    <main className="space-y-5">
      <PvPageHeader title="Public Subscription" subtitle="Registrations from your public link" />

      {session?.position && <PublicLinkCard place={session.position.organisation} />}

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="rounded-2xl bg-white px-4 pt-6 pb-8 sm:px-6">
        <div className="flex gap-2" role="tablist" aria-label="Status">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => chooseTab(tab.value)}
              className={`rounded-full px-4 py-1.5 text-[13px] ${status === tab.value ? "bg-navy text-white" : "bg-[#f3ebe2] text-[#555] hover:bg-[#ecdfd1]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`mt-5 overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="bg-[#f3ebe2] text-[12px] font-medium text-[#555]">
                {columns.map((column, index) => (
                  <th key={index} scope="col" className="px-2.5 py-3.5 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#333]">
              {items.map((row) => (
                <tr
                  key={row.subscriber_id}
                  className={`${clickableRowClass} align-top`}
                  onClick={onRowClick(() => navigate(subscriberPath(row.subscriber_id, row.subscription_year)))}
                >
                  <td className="px-2.5 py-3 font-medium text-navy">
                    <Link to={subscriberPath(row.subscriber_id, row.subscription_year)} className="hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-2.5 py-3 whitespace-nowrap">{formatMobile(row.mobile_country, row.mobile)}</td>
                  <td className="px-2.5 py-3">{row.unit.name ?? "—"}</td>
                  <td className="px-2.5 py-3 whitespace-nowrap">{modeLabel(row.subscription_mode)}</td>
                  <td className="px-2.5 py-3 whitespace-nowrap">
                    {row.amount !== null && row.currency ? formatAmount(row.amount, row.currency) : "—"}
                  </td>
                  <td className="max-w-[220px] px-2.5 py-3">{row.address || "—"}</td>
                  <td className="px-2.5 py-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-2.5 py-3">
                    {pending ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="rounded-full"
                          disabled={approvingId !== null}
                          onClick={() => void approve(row)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-red-600"
                          disabled={approvingId !== null}
                          onClick={() => setRejecting(row)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <StatusBadge tone={TONE[row.approval_status]}>
                          {row.approval_status === "APPROVED" ? "Approved" : "Rejected"}
                        </StatusBadge>
                        {row.reject_reason && <p className="text-[12px] text-[#6b6b6b]">{row.reject_reason}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p className="border-b border-[#e7e1da] px-2.5 py-10 text-center text-[14px] text-[#6b6b6b]">
            {loading ? <Loader variant="inline" /> : pending ? "No registrations waiting for approval." : "Nothing here yet."}
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

      <RejectDialog name={rejecting?.name ?? null} onCancel={() => setRejecting(null)} onConfirm={reject} />
    </main>
  );
}

export default PvPublicPage;
