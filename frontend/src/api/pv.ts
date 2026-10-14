import api, { unwrap } from "./axios";
import type { ApiEnvelope } from "../types/auth";
import type {
  AnalysisFilters,
  AnalysisPlaces,
  AnalysisSubscriptionPage,
  AnalysisSummary,
  SubscriptionSort,
} from "../types/pvAnalysis";
import type {
  CreatedRegistration,
  IcfMember,
  NewPublicRegistration,
  PublicRegistrationPage,
  PublicStatus,
  PvFormApi,
  RenewalPage,
  SubscriberView,
  SubscriptionUpdate,
  SubscriberLookup,
  NewRegistration,
  OrgPlace,
  PvAnalytics,
  PvTargets,
  TargetsSave,
  RegistrationContext,
  RegistrationPage,
  RegistrationPrice,
} from "../types/pv";

// Pravasi Vayana calls. This data belongs to one page, so it is fetched there rather than kept in
// the Redux store.

export async function fetchRegistrationContext(): Promise<RegistrationContext> {
  const { data } = await api.get<ApiEnvelope<RegistrationContext>>("/pv/registration/context");
  return unwrap(data);
}

/** The places directly below `parentId`, for the next organisation dropdown. */
export async function fetchChildPlaces(parentId: number): Promise<OrgPlace[]> {
  const { data } = await api.get<ApiEnvelope<{ places: OrgPlace[] }>>("/pv/registration/children", {
    params: { parent_id: parentId },
  });
  return unwrap(data).places;
}

export async function fetchRegistrationPrice(unitId: number): Promise<RegistrationPrice> {
  const { data } = await api.get<ApiEnvelope<RegistrationPrice>>("/pv/registration/price", {
    params: { unit_id: unitId },
  });
  return unwrap(data);
}

export async function createRegistration(body: NewRegistration): Promise<CreatedRegistration> {
  const { data } = await api.post<ApiEnvelope<CreatedRegistration>>("/pv/registrations", body);
  return unwrap(data);
}

/** Without a year, the latest year that has subscriptions; without orgId, the leader's own place. */
export async function fetchPvAnalytics(params: { year?: number; orgId?: number }): Promise<PvAnalytics> {
  const { data } = await api.get<ApiEnvelope<PvAnalytics>>("/pv/analytics", {
    params: { year: params.year, org_id: params.orgId },
  });
  return unwrap(data);
}

export async function fetchRegistrations(params: { year?: number; page: number; pageSize: number }): Promise<RegistrationPage> {
  const { data } = await api.get<ApiEnvelope<RegistrationPage>>("/pv/registrations", {
    params: { year: params.year, page: params.page, page_size: params.pageSize },
  });
  return unwrap(data);
}

/** "Is Existing Subscriber" search: a subscriber number, ledger number or mobile number. */
/** By subscriber number, mobile, name, address or ledger; orgId keeps it to one place. */
export async function lookupSubscribers(q: string, orgId?: number): Promise<SubscriberLookup> {
  const { data } = await api.get<ApiEnvelope<SubscriberLookup>>("/pv/subscribers/lookup", {
    params: { q: q || undefined, org_id: orgId },
  });
  return unwrap(data);
}

export async function lookupMember(membershipNo: string): Promise<IcfMember> {
  const { data } = await api.get<ApiEnvelope<IcfMember>>("/pv/members/lookup", { params: { membership_no: membershipNo } });
  return unwrap(data);
}

export async function fetchRenewals(params: {
  status: "all" | "renew" | "renewed";
  search?: string;
  page: number;
  pageSize: number;
}): Promise<RenewalPage> {
  const { data } = await api.get<ApiEnvelope<RenewalPage>>("/pv/renewals", {
    params: { status: params.status, search: params.search || undefined, page: params.page, page_size: params.pageSize },
  });
  return unwrap(data);
}

export async function fetchPublicRegistrations(params: {
  status: PublicStatus;
  page: number;
  pageSize: number;
}): Promise<PublicRegistrationPage> {
  const { data } = await api.get<ApiEnvelope<PublicRegistrationPage>>("/pv/public-registrations", {
    params: { status: params.status, page: params.page, page_size: params.pageSize },
  });
  return unwrap(data);
}

export async function approvePublicRegistration(subscriberId: number): Promise<void> {
  await api.post(`/pv/public-registrations/${subscriberId}/approve`);
}

export async function rejectPublicRegistration(subscriberId: number, reason: string): Promise<void> {
  await api.post(`/pv/public-registrations/${subscriberId}/reject`, { reason });
}

/** The subscription form as a leader uses it. */
export const leaderFormApi: PvFormApi = {
  loadContext: fetchRegistrationContext,
  loadChildren: fetchChildPlaces,
  loadPrice: fetchRegistrationPrice,
};

// Public link calls: no login. rootId is the leader's place the link was made for.

/** The subscription form as opened from a leader's public link. */
export function publicFormApi(rootId: number): PvFormApi {
  return {
    async loadContext() {
      const { data } = await api.get<ApiEnvelope<RegistrationContext>>(`/public/pv/links/${rootId}`);
      return unwrap(data);
    },
    async loadChildren(parentId) {
      const { data } = await api.get<ApiEnvelope<{ places: OrgPlace[] }>>(`/public/pv/links/${rootId}/children`, {
        params: { parent_id: parentId },
      });
      return unwrap(data).places;
    },
    async loadPrice(unitId) {
      const { data } = await api.get<ApiEnvelope<RegistrationPrice>>(`/public/pv/links/${rootId}/price`, {
        params: { unit_id: unitId },
      });
      return unwrap(data);
    },
  };
}

export async function createPublicRegistration(body: NewPublicRegistration): Promise<CreatedRegistration> {
  const { data } = await api.post<ApiEnvelope<CreatedRegistration>>("/public/pv/registrations", body);
  return unwrap(data);
}

/** Without a year, the subscriber's latest subscription. */
export async function fetchSubscriber(subscriberId: number, year?: number): Promise<SubscriberView> {
  const { data } = await api.get<ApiEnvelope<SubscriberView>>(`/pv/subscribers/${subscriberId}`, { params: { year } });
  return unwrap(data);
}

export async function updateSubscription(
  subscriberId: number,
  year: number,
  body: SubscriptionUpdate,
): Promise<{ subscriber_id: number; subscription_year: number; currency: string; amount: number }> {
  const { data } = await api.put<ApiEnvelope<{ subscriber_id: number; subscription_year: number; currency: string; amount: number }>>(
    `/pv/subscribers/${subscriberId}/subscriptions/${year}`,
    body,
  );
  return unwrap(data);
}

/** Without orgId, the leader's own place. */
export async function fetchPvTargets(orgId?: number): Promise<PvTargets> {
  const { data } = await api.get<ApiEnvelope<PvTargets>>("/pv/targets", { params: { org_id: orgId } });
  return unwrap(data);
}

export async function savePvTargets(body: TargetsSave): Promise<{ saved: number }> {
  const { data } = await api.put<ApiEnvelope<{ saved: number }>>("/pv/targets", body);
  return unwrap(data);
}

// Campaign analysis: the filters as query parameters, leaving out the defaults.
function analysisParams(filters: AnalysisFilters) {
  return {
    year: filters.year,
    org_id: filters.orgId,
    range: filters.range === "campaign" ? undefined : filters.range,
    from: filters.range === "custom" ? filters.from : undefined,
    to: filters.range === "custom" ? filters.to : undefined,
    category: filters.category === "all" ? undefined : filters.category,
    payment: filters.payment === "all" ? undefined : filters.payment,
    member: filters.member === "all" ? undefined : filters.member,
    status: filters.status === "approved" ? undefined : filters.status,
    search: filters.search || undefined,
  };
}

export async function fetchAnalysisSummary(filters: AnalysisFilters): Promise<AnalysisSummary> {
  const { data } = await api.get<ApiEnvelope<AnalysisSummary>>("/pv/analysis/summary", { params: analysisParams(filters) });
  return unwrap(data);
}

export async function fetchAnalysisPlaces(filters: AnalysisFilters): Promise<AnalysisPlaces> {
  const { data } = await api.get<ApiEnvelope<AnalysisPlaces>>("/pv/analysis/places", { params: analysisParams(filters) });
  return unwrap(data);
}

/** One page, or with `exportAll` every matching row (up to 10,000) for a download. */
export async function fetchAnalysisSubscriptions(
  filters: AnalysisFilters,
  options: { tab: "all" | "new" | "old"; sort: SubscriptionSort; dir: "asc" | "desc"; page: number; pageSize: number; exportAll?: boolean },
): Promise<AnalysisSubscriptionPage> {
  const { data } = await api.get<ApiEnvelope<AnalysisSubscriptionPage>>("/pv/analysis/subscriptions", {
    params: {
      ...analysisParams(filters),
      tab: options.tab,
      sort: options.sort,
      dir: options.dir,
      page: options.page,
      page_size: options.pageSize,
      export: options.exportAll ? "1" : undefined,
    },
  });
  return unwrap(data);
}
