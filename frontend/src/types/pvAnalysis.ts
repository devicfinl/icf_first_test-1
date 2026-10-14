import type { OrgPlace, SubscriptionMode } from "./pv";

/** Campaign analysis filters, as kept in the URL. See docs/API.md, "Campaign analysis". */
export const RANGES = ["today", "yesterday", "1h", "8h", "24h", "7d", "30d", "campaign", "custom"] as const;
export type AnalysisRange = (typeof RANGES)[number];

export type AnalysisFilters = {
  year?: number;
  orgId?: number;
  range: AnalysisRange;
  /** YYYY-MM-DD, with range "custom". */
  from?: string;
  to?: string;
  category: "all" | "new" | "renew";
  payment: "all" | "paid" | "unpaid";
  member: "all" | "yes" | "no";
  status: "approved" | "pending" | "rejected" | "all";
  search?: string;
};

export type AnalysisScope = {
  place: OrgPlace;
  path: OrgPlace[];
  /** The leader's own place: the report goes no higher. */
  top_id: number;
};

type Base = { year: number | null; years: number[]; scope: AnalysisScope };

/** GET /pv/analysis/summary: the cards above each tab. */
export type AnalysisSummary = Base & {
  totals: { subscriptions: number; new: number; renewals: number; paid: number; unpaid: number };
  amounts: { currency: string; total: number; received: number; pending: number }[];
};

export type SubscriptionSort = "created_at" | "updated_at" | "name" | "amount" | "mode" | "category";

export type AnalysisSubscription = {
  subscriber_id: number;
  name: string;
  mobile_country: string | null;
  mobile: string | null;
  is_icf_member: "Yes" | "No" | null;
  ledger_no: string | null;
  year: number | null;
  subscription_mode: SubscriptionMode;
  registration_type: "NEW" | "RENEW";
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  currency: string | null;
  amount: number | null;
  paid: boolean;
  unit: OrgPlace;
  /** The places between the report's place and the unit. */
  under: OrgPlace[];
  added_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Old Subscribers tab only: subscribed again this year. */
  renewed?: boolean;
};

/** GET /pv/analysis/subscriptions. */
export type AnalysisSubscriptionPage = Base & {
  total: number;
  page: number;
  page_size: number;
  rows: AnalysisSubscription[];
};

export type PlaceAnalysis = {
  subscriptions: number;
  new: number;
  renewals: number;
  /** print + digital target; null when not set. */
  target: number | null;
  /** subscriptions ÷ target. */
  achieved: number | null;
  paid: number;
  unpaid: number;
  paid_rate: number | null;
  amounts: { currency: string; received: number; pending: number }[];
  units: number;
  /** Units with at least one subscription. */
  active_units: number;
  participation: number | null;
  last_year: number;
  growth: number;
  growth_rate: number | null;
};

/** GET /pv/analysis/places: each place directly below the report's place. */
export type AnalysisPlaces = Base & {
  totals: PlaceAnalysis;
  places: (OrgPlace & PlaceAnalysis & { rank: number })[];
};
