import type {
  ExistingSubscriber,
  NewPublicRegistration,
  NewRegistration,
  SubscriberView,
  SubscriptionMode,
} from "../types/pv";
import type { AddSubscriberFormData, AddSubscriberFormInput } from "../utilities/validation";

/** The Add Subscriber form with nothing entered. Cash received defaults to No. */
export const EMPTY_SUBSCRIBER_FORM: AddSubscriberFormInput = {
  isExisting: "N",
  subscriberId: undefined,
  isIcfMember: "",
  membershipId: "",
  unitId: undefined as unknown as number,
  name: "",
  shopName: "",
  floorNo: "",
  buildingName: "",
  street: "",
  area: "",
  province: "",
  mobileCountry: "",
  mobile: "",
  whatsappCountry: "",
  whatsapp: "",
  email: "",
  contactPersonName: "",
  subscriptionMode: undefined as unknown as SubscriptionMode,
  distributorArea: "",
  deliveryResponsibility: "",
  cashReceived: "N",
};

// The country is the National level; everything else is labelled by its own level name.
export const levelLabel = (level: string | null | undefined) => (level === "National" ? "Country" : (level ?? "Place"));

// OMR, KWD and BHD are quoted to 3 decimals, the other Gulf currencies to 2.
export function formatAmount(amount: number, currency: string): string {
  const decimals = ["OMR", "KWD", "BHD"].includes(currency) ? 3 : 2;
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
}

export const includesPrint = (mode: SubscriptionMode | undefined) => mode === "Print" || mode === "Print&Digital";

// Form values -> request body: empty optional fields are left out, and '+' is dropped from codes.
export function toRegistrationRequest(data: AddSubscriberFormData): NewRegistration {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    unitId: data.unitId,
    name: data.name,
    shopName: optional(data.shopName),
    floorNo: optional(data.floorNo),
    buildingName: data.buildingName,
    street: optional(data.street),
    area: optional(data.area),
    province: data.province,
    mobileCountry: data.mobileCountry.replace(/^\+/, ""),
    mobile: data.mobile,
    whatsappCountry: data.whatsapp ? data.whatsappCountry.replace(/^\+/, "") : undefined,
    whatsapp: optional(data.whatsapp),
    email: optional(data.email),
    contactPersonName: optional(data.contactPersonName),
    subscriptionMode: data.subscriptionMode,
    distributorArea: optional(data.distributorArea),
    deliveryResponsibility: includesPrint(data.subscriptionMode) ? optional(data.deliveryResponsibility) : undefined,
    cashReceived: data.cashReceived,
    subscriberId: data.isExisting === "Y" ? data.subscriberId : undefined,
    // Asked only of a new subscriber.
    isIcfMember: data.isExisting === "N" && data.isIcfMember ? data.isIcfMember : undefined,
    membershipId: data.isExisting === "N" && data.isIcfMember === "Yes" ? data.membershipId : undefined,
  };
}

/** Form values -> public request body: no cash received or renewal; rootId is the link's place. */
export function toPublicRequest(data: AddSubscriberFormData, rootId: number): NewPublicRegistration {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cashReceived, subscriberId, isIcfMember, membershipId, ...rest } = toRegistrationRequest(data);
  return { ...rest, rootId };
}

/** Progress as a percentage with two decimals, e.g. 64.98%. */
export const formatPercent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * The form values an existing subscriber fills in: their contact details and their previous
 * subscription's address, mode and distribution. The unit is left to the leader's choice.
 */
export function formFromExisting(subscriber: ExistingSubscriber): Partial<AddSubscriberFormInput> {
  const text = (value: string | null) => value ?? "";
  const { previous } = subscriber;
  return {
    subscriberId: subscriber.subscriber_id,
    name: subscriber.name,
    mobileCountry: text(subscriber.mobile_country),
    mobile: text(subscriber.mobile),
    whatsappCountry: text(subscriber.whatsapp_country),
    whatsapp: text(subscriber.whatsapp),
    email: text(subscriber.email),
    shopName: text(previous.shop_name),
    floorNo: text(previous.floor_no),
    buildingName: text(previous.building_name),
    street: text(previous.street),
    area: text(previous.area),
    province: text(previous.province),
    contactPersonName: text(previous.contact_person_name),
    subscriptionMode: previous.subscription_mode,
    distributorArea: text(previous.distributor_area),
    deliveryResponsibility: includesPrint(previous.subscription_mode) ? text(previous.delivery_responsibility) : "",
  };
}

/** "Print&Digital" -> "Print & Digital", for display. */
export const modeLabel = (mode: SubscriptionMode) => mode.replace("&", " & ");

/** "APPROVED" -> "Approved". */
export const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** "+968 91678230", or "—" without a number. */
export const formatMobile = (country: string | null, mobile: string | null) =>
  mobile ? `${country ? `+${country} ` : ""}${mobile}` : "—";

/** The edit form filled from a subscriber's view: contact details and the subscription itself. */
export function formFromView(view: SubscriberView): AddSubscriberFormInput {
  const text = (value: string | null) => value ?? "";
  const { subscriber, subscription } = view;
  return {
    ...EMPTY_SUBSCRIBER_FORM,
    unitId: subscription.unit.id,
    name: subscriber.name,
    mobileCountry: text(subscriber.mobile_country),
    mobile: text(subscriber.mobile),
    whatsappCountry: text(subscriber.whatsapp_country),
    whatsapp: text(subscriber.whatsapp),
    email: text(subscriber.email),
    shopName: text(subscription.shop_name),
    floorNo: text(subscription.floor_no),
    buildingName: text(subscription.building_name),
    street: text(subscription.street),
    area: text(subscription.area),
    province: text(subscription.province),
    contactPersonName: text(subscription.contact_person_name),
    subscriptionMode: subscription.subscription_mode,
    distributorArea: text(subscription.distributor_area),
    deliveryResponsibility: includesPrint(subscription.subscription_mode) ? text(subscription.delivery_responsibility) : "",
    cashReceived: subscription.cash_received === "Y" ? "Y" : "N",
  };
}
