import api, { unwrap } from "./axios";
import type { ApiEnvelope } from "../types/auth";
import type {
  CreatedRegistration,
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
export async function lookupSubscribers(q: string): Promise<SubscriberLookup> {
  const { data } = await api.get<ApiEnvelope<SubscriberLookup>>("/pv/subscribers/lookup", { params: { q } });
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
