import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import AddSubscriberDrawer from "../components/pv/AddSubscriberDrawer";
import StatusBadge from "../components/pv/StatusBadge";
import Loader from "../components/loading-ui/Loader";
import { apiErrorMessage } from "../api/axios";
import { fetchSubscriber } from "../api/pv";
import { formatAmount, formatDate, formatMobile, levelLabel, modeLabel, titleCase } from "../lib/pv";
import type { SubscriberView } from "../types/pv";

const STATUS_TONE = { APPROVED: "green", PENDING: "amber", REJECTED: "red" } as const;

/** A titled white card with label/value rows. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white px-5 py-4 sm:px-6">
      <h2 className="text-[15px] font-semibold text-navy">{title}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[#6b6b6b]">{label}</dt>
      <dd className="mt-0.5 text-[14px] break-words text-[#222]">{value === null || value === "" ? "—" : value}</dd>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/**
 * Pravasi Vayana: one subscriber. Contact details, one year's subscription in full (the latest, or
 * ?year=), where it sits, who added and approved it, and every year as history. Edit opens the
 * form in a drawer when that year's subscription can still be changed.
 */
function PvSubscriberPage() {
  const navigate = useNavigate();
  const { subscriberId } = useParams();
  const [params] = useSearchParams();
  const id = Number(subscriberId);
  const year = params.get("year") ? Number(params.get("year")) : undefined;

  const [view, setView] = useState<SubscriberView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    fetchSubscriber(id, year)
      .then((loaded) => {
        if (!current) return;
        setView(loaded);
        setError(null);
      })
      .catch((failure) => current && setError(apiErrorMessage(failure, "Could not load this subscriber.")));
    return () => {
      current = false;
    };
  }, [id, year, refreshKey]);

  const loading = !view && !error;
  const subscriber = view?.subscriber;
  const subscription = view?.subscription;

  return (
    <main className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="group/button -ml-2.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="transition-transform duration-200 group-hover/button:-translate-x-0.5 motion-reduce:transform-none" />
        Back
      </Button>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <Loader label="Loading subscriber…" className="min-h-[300px] rounded-2xl bg-white" />}

      {subscriber && subscription && view && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-5 py-4 sm:px-6">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#f3ebe2] text-lg font-semibold text-clay">
              {initials(subscriber.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[22px] font-semibold text-navy">{subscriber.name}</h1>
              <p className="text-[13px] text-[#6b6b6b]">
                No. {subscriber.subscriber_id}
                {subscriber.ledger_no ? ` · Ledger ${subscriber.ledger_no}` : ""}
                {subscription.year ? ` · Subscription ${subscription.year}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge tone={STATUS_TONE[subscription.approval_status]}>
                  {titleCase(subscription.approval_status)}
                </StatusBadge>
                <StatusBadge tone="amber">{subscription.registration_type === "RENEW" ? "Renewed" : "New"}</StatusBadge>
                <StatusBadge tone="green">{subscription.registration_method === "PUBLIC" ? "Public" : "Direct"}</StatusBadge>
              </div>
            </div>
            {view.allowed_actions.edit ? (
              <Button className="rounded-full" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
            ) : (
              view.edit_blocked_reason && <p className="max-w-[260px] text-[12px] text-[#6b6b6b]">{view.edit_blocked_reason}</p>
            )}
          </div>

          {subscription.reject_reason && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription>Rejected: {subscription.reject_reason}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Organization">
              {subscription.path.map((place) => (
                <Row key={place.id} label={levelLabel(place.level)} value={place.name} />
              ))}
            </Section>

            <Section title="Contact">
              <Row label="Mobile" value={formatMobile(subscriber.mobile_country, subscriber.mobile)} />
              <Row label="WhatsApp" value={subscriber.whatsapp ? formatMobile(subscriber.whatsapp_country, subscriber.whatsapp) : null} />
              <Row label="Email" value={subscriber.email} />
              <Row label="Contact Person / Sponsor" value={subscription.contact_person_name} />
            </Section>

            <Section title="Address">
              <Row label="Flat/Villa/Shop Name" value={subscription.shop_name} />
              <Row label="Floor No." value={subscription.floor_no} />
              <Row label="Building Name" value={subscription.building_name} />
              <Row label="Street" value={subscription.street} />
              <Row label="Area" value={subscription.area} />
              <Row label="State/Province/Emirate" value={subscription.province} />
            </Section>

            <Section title="Subscription & Payment">
              <Row label="Subscription Mode" value={modeLabel(subscription.subscription_mode)} />
              <Row label="Year" value={subscription.year} />
              <Row label="Distribution Lead" value={subscription.distributor_area} />
              <Row label="Delivery responsibility" value={subscription.delivery_responsibility} />
              <Row
                label="Amount"
                value={
                  subscription.amount !== null && subscription.currency
                    ? formatAmount(subscription.amount, subscription.currency)
                    : null
                }
              />
              <Row label="Cash Received" value={subscription.cash_received === "Y" ? "Yes" : "No"} />
            </Section>

            <Section title="Registration">
              <Row label="Registered on" value={formatDate(subscription.created_at)} />
              <Row label="Added by" value={subscription.added_by} />
              <Row label="Approved by" value={subscription.approved_by} />
              <Row label="Approved on" value={subscription.approved_at ? formatDate(subscription.approved_at) : null} />
              {subscription.updated_at && <Row label="Last updated" value={formatDate(subscription.updated_at)} />}
              {subscription.address_change === "Yes" && <Row label="Address" value="Changed from last year" />}
            </Section>
          </div>

          <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
            <h2 className="px-1 text-[15px] font-semibold text-navy">History</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f3ebe2] text-[12px] font-medium text-[#555]">
                    {["Year", "Unit", "Mode", "Amount", "Type", "Status"].map((column) => (
                      <th key={column} scope="col" className="px-2.5 py-3 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[13px] text-[#333]">
                  {view.history.map((row, index) => {
                    const shown = row.year === subscription.year;
                    return (
                      <tr key={`${row.year}-${index}`} className={`border-b border-[#eee] ${shown ? "bg-[#fbf7f2]" : ""}`}>
                        <td className="px-2.5 py-3 font-medium">
                          {shown || row.year === null ? (
                            row.year ?? "—"
                          ) : (
                            <Link to={`/pv/subscribers/${subscriber.subscriber_id}?year=${row.year}`} className="text-clay hover:underline">
                              {row.year}
                            </Link>
                          )}
                        </td>
                        <td className="px-2.5 py-3">{row.unit.name ?? "—"}</td>
                        <td className="px-2.5 py-3">{modeLabel(row.subscription_mode)}</td>
                        <td className="px-2.5 py-3 whitespace-nowrap">
                          {row.amount !== null && row.currency ? formatAmount(row.amount, row.currency) : "—"}
                        </td>
                        <td className="px-2.5 py-3">{row.registration_type === "RENEW" ? "Renewed" : "New"}</td>
                        <td className="px-2.5 py-3">
                          <StatusBadge tone={STATUS_TONE[row.approval_status]}>{titleCase(row.approval_status)}</StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <AddSubscriberDrawer
            key={`${subscriber.subscriber_id}:${subscription.year}:${refreshKey}`}
            open={editing}
            editing={view}
            onOpenChange={setEditing}
            onEdited={() => setRefreshKey((key) => key + 1)}
          />
        </>
      )}
    </main>
  );
}

export default PvSubscriberPage;
