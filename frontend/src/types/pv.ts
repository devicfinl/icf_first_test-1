/** Pravasi Vayana registration shapes. See docs/API.md, "Pravasi Vayana registration". */

/** A place in the organisation hierarchy (National, Chapter, Region, Division or Unit). */
export type OrgPlace = { id: number; name: string | null; level: string | null };

/** GET /pv/registration/context */
export type RegistrationContext = {
  /** The leader's own place. */
  leader: OrgPlace;
  /** From the country down to the leader's place. Fixed: the leader cannot change these. */
  path: OrgPlace[];
  /** False for a Unit leader, whose own unit is used. */
  choose_unit: boolean;
};

export const SUBSCRIPTION_MODES = ["Print", "Digital", "Print&Digital"] as const;
export type SubscriptionMode = (typeof SUBSCRIPTION_MODES)[number];
/** The modes a new subscription can choose; Print&Digital is kept above only for old records. */
export const SELECTABLE_SUBSCRIPTION_MODES = ["Print", "Digital"] as const satisfies readonly SubscriptionMode[];

/** GET /pv/registration/price: the open campaign for the unit's country. */
export type RegistrationPrice = {
  country_code: string;
  /** The country's phone code, e.g. "968"; null when it is not known. */
  phone_code: string | null;
  year: number;
  currency: string;
  campaign_status: string | null;
  /** null when no price is set for that mode. */
  prices: Record<SubscriptionMode, number | null>;
};

/** POST /pv/registrations. Year, currency and amount are set by the server. */
export type NewRegistration = {
  unitId: number;
  name: string;
  shopName?: string;
  floorNo?: string;
  buildingName: string;
  street?: string;
  area?: string;
  province: string;
  mobileCountry: string;
  mobile: string;
  whatsappCountry?: string;
  whatsapp?: string;
  email?: string;
  contactPersonName?: string;
  subscriptionMode: SubscriptionMode;
  distributorArea?: string;
  deliveryResponsibility?: string;
  cashReceived: "Y" | "N";
  /** Set when renewing an existing subscriber found with the lookup. */
  subscriberId?: number;
  /** A new subscriber only. */
  isIcfMember?: "Yes" | "No";
  membershipId?: string;
};

export type CreatedRegistration = {
  subscriber_id: number;
  /** Leader's form only. */
  registration_type?: "NEW" | "RENEW";
  /** Public form only: PENDING until a leader approves it. */
  approval_status?: "PENDING";
  subscription_year: number;
  currency: string;
  amount: number;
};

/** Work progress numbers of one place (or of a whole report). Only approved subscriptions count. */
export type PvProgress = {
  subscriptions: number;
  new: number;
  renewals: number;
  /** Last year's subscribers there: the most that could renew. */
  renewable: number;
  /** Subscriptions with cash received. */
  paid: number;
  /** Achieved per channel; old Print&Digital subscriptions count as print. */
  print: number;
  digital: number;
  membership: number;
  total_units: number;
  /** print + digital target from Set Target; 0 until it is set. */
  target: number;
  target_print: number;
  target_digital: number;
  /** subscriptions ÷ target; null when there is no target. */
  progress: number | null;
};

/** GET /pv/analytics: one year of work progress for a place and the places directly below it. */
export type PvAnalytics = {
  /** null when the place has no subscriptions yet. */
  year: number | null;
  /** Years that have subscriptions, latest first. */
  years: number[];
  scope: {
    place: OrgPlace;
    /** From the country down to the place. */
    path: OrgPlace[];
    /** The leader's own place: the report can go up to here and no further. */
    top_id: number;
  };
  totals: PvProgress;
  by_mode: Record<SubscriptionMode, number>;
  /** New and renewed subscriptions added on each day (YYYY-MM-DD, earliest first). */
  by_day: { day: string; new: number; renewals: number }[];
  /** Per currency, with the amount added on each day (YYYY-MM-DD, earliest first). */
  amounts: {
    currency: string;
    total: number;
    received: number;
    by_day: { day: string; total: number; received: number }[];
  }[];
  places: (OrgPlace & PvProgress)[];
};

/** One row of GET /pv/registrations. */
export type RegistrationListItem = {
  subscriber_id: number;
  name: string;
  mobile_country: string | null;
  mobile: string | null;
  unit: OrgPlace;
  subscription_mode: SubscriptionMode;
  currency: string | null;
  amount: number | null;
  cash_received: "Y" | "N" | null;
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  registration_method: "DIRECT" | "PUBLIC";
  created_at: string | null;
};

/** GET /pv/registrations: new registrations (not renewals), newest first. */
export type RegistrationPage = {
  year: number | null;
  /** Years that have subscriptions, latest first. */
  years: number[];
  page: number;
  page_size: number;
  total: number;
  items: RegistrationListItem[];
};

/** One result of GET /pv/subscribers/lookup, with the subscription the form is filled from. */
export type ExistingSubscriber = {
  subscriber_id: number;
  name: string;
  ledger_no: string | null;
  mobile_country: string | null;
  mobile: string | null;
  whatsapp_country: string | null;
  whatsapp: string | null;
  email: string | null;
  /** As recorded: null when never asked. */
  is_icf_member: "Yes" | "No" | null;
  /** The ICF membership number; null unless is_icf_member is "Yes". */
  membership_id: string | null;
  /** Already has a subscription for the open campaign year: cannot be renewed again. */
  already_registered_this_year: boolean;
  previous: {
    year: number | null;
    unit: OrgPlace;
    /** The organisation dropdown choices below the leader's place, ending with the unit. */
    path: OrgPlace[];
    subscription_mode: SubscriptionMode;
    shop_name: string | null;
    floor_no: string | null;
    building_name: string | null;
    street: string | null;
    area: string | null;
    province: string | null;
    distributor_area: string | null;
    delivery_responsibility: string | null;
    contact_person_name: string | null;
  };
};

export type SubscriberLookup = {
  /** The open campaign year; null while no campaign is open. */
  year: number | null;
  subscribers: ExistingSubscriber[];
  /** More matched than are shown: narrow the search. */
  more?: boolean;
};

/** GET /pv/members/search: members in the leader's branch matching a number or name. */
export type MemberSearch = {
  members: { membership_no: string; name: string; active: boolean; unit: string | null }[];
  /** More matched than were returned. */
  more: boolean;
};

/** GET /pv/members/lookup: an ICF member in the leader's branch, to fill a new subscriber's details. */
export type IcfMember = {
  membership_no: string;
  name: string;
  active: boolean;
  mobile_country: string | null;
  mobile: string | null;
  whatsapp: string | null;
  unit: OrgPlace | null;
  /** Below the leader's place, down to the member's unit: the form's dropdowns. */
  path: OrgPlace[];
  /** Already a subscriber: renew them instead. */
  existing_subscriber: { subscriber_id: number; name: string } | null;
};

/** GET /pv/renewals: last year's subscribers, to renew in `year`. */
export type RenewalPage = {
  year: number | null;
  page: number;
  page_size: number;
  total: number;
  /** already_registered_this_year = renewed. */
  items: ExistingSubscriber[];
};

export type PublicStatus = "PENDING" | "APPROVED" | "REJECTED";

/** One row of GET /pv/public-registrations. */
export type PublicRegistration = {
  subscriber_id: number;
  name: string;
  mobile_country: string | null;
  mobile: string | null;
  unit: OrgPlace;
  subscription_year: number | null;
  subscription_mode: SubscriptionMode;
  currency: string | null;
  amount: number | null;
  address: string;
  approval_status: PublicStatus;
  reject_reason: string | null;
  created_at: string | null;
};

export type PublicRegistrationPage = {
  status: PublicStatus;
  page: number;
  page_size: number;
  total: number;
  items: PublicRegistration[];
};

/** POST /public/pv/registrations: the leader's form without cash received or renewal. */
export type NewPublicRegistration = Omit<NewRegistration, "cashReceived" | "subscriberId" | "isIcfMember" | "membershipId"> & {
  rootId: number;
};

/** Where the subscription form loads its data from and saves to: the leader's API or a public link. */
export type PvFormApi = {
  loadContext: () => Promise<RegistrationContext>;
  loadChildren: (parentId: number) => Promise<OrgPlace[]>;
  loadPrice: (unitId: number) => Promise<RegistrationPrice>;
};

/** GET /pv/subscribers/{id}: one subscriber and one year's subscription in full. */
export type SubscriberView = {
  subscriber: {
    subscriber_id: number;
    name: string;
    ledger_no: string | null;
    mobile_country: string | null;
    mobile: string | null;
    whatsapp_country: string | null;
    whatsapp: string | null;
    email: string | null;
  };
  subscription: {
    year: number | null;
    unit: OrgPlace;
    /** From the country down to the unit. */
    path: OrgPlace[];
    /** The organisation dropdown choices below the leader's place, for the edit form. */
    form_path: OrgPlace[];
    subscription_mode: SubscriptionMode;
    shop_name: string | null;
    floor_no: string | null;
    building_name: string | null;
    street: string | null;
    area: string | null;
    province: string | null;
    distributor_area: string | null;
    delivery_responsibility: string | null;
    contact_person_name: string | null;
    currency: string | null;
    amount: number | null;
    cash_received: "Y" | "N" | null;
    registration_type: "NEW" | "RENEW";
    registration_method: "DIRECT" | "PUBLIC";
    approval_status: PublicStatus;
    reject_reason: string | null;
    address_change: string | null;
    added_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  /** Every year, latest first. */
  history: {
    year: number | null;
    unit: OrgPlace;
    subscription_mode: SubscriptionMode;
    currency: string | null;
    amount: number | null;
    registration_type: "NEW" | "RENEW";
    approval_status: PublicStatus;
  }[];
  allowed_actions: { edit: boolean };
  /** Why editing is not allowed, when it is not. */
  edit_blocked_reason: string | null;
};

/** PUT /pv/subscribers/{id}/subscriptions/{year}: the leader's form without renewal. */
export type SubscriptionUpdate = Omit<NewRegistration, "subscriberId">;

/** A print and a digital number, and their sum. */
export type TargetPair = { print: number; digital: number; total: number };

export type TargetStatus = "Not set" | "Draft" | "Set" | "Over-allocated";

/** GET /pv/targets: a place's own target, what it has shared out, and the places directly below it. */
export type PvTargets = {
  place: OrgPlace;
  path: OrgPlace[];
  /** The leader's own place: drill-down never goes above it. */
  top_id: number;
  /** The campaign year shown: its targets, and achieved counted for it. */
  year: number;
  /** The campaign years that have targets, newest first. */
  years: number[];
  /** The year shown is a finished campaign: its targets are shown but cannot be changed. */
  closed: boolean;
  /** The year after the latest with targets. */
  next_year: number;
  /** International only, before anything is set for next_year: it starts the next campaign. */
  can_start_next: boolean;
  own: (TargetPair & { status: "Active" | "Draft" | "Closed" }) | null;
  allocated: TargetPair;
  /** null until the place's own target is set. */
  remaining: TargetPair | null;
  achieved: TargetPair;
  /** achieved ÷ target per channel; null without a target. */
  progress: { print: number | null; digital: number | null };
  /** International only: it sets its own target. */
  can_edit_own: boolean;
  can_allocate: boolean;
  /** Why the leader cannot share out their target yet. */
  blocked_reason: string | null;
  children: (OrgPlace & {
    target: TargetPair | null;
    status: TargetStatus;
    achieved: TargetPair;
    progress: { print: number | null; digital: number | null };
    has_children: boolean;
  })[];
};

/** PUT /pv/targets. */
export type TargetsSave = {
  /** The campaign year the targets are for. */
  year: number;
  status: "Active" | "Draft";
  own?: { print: number; digital: number };
  children: { org_id: number; print: number; digital: number }[];
};
