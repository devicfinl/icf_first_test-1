/** Shapes returned by the backend. See docs/API.md and backend/src/utils/response.ts. */

/** Every endpoint answers with this envelope; `data` is null whenever `success` is false. */
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  /** Only present when a request failed field-level validation. */
  errors?: { field: string; message: string }[];
};

export type AuthToken = {
  token: string;
  token_type: string;
  /** Seconds until the token expires. */
  expires_in: number;
};

/** A committee position the member may act as for the session. */
export type MemberPosition = {
  id: number;
  designation: { id: number; name: string; level: number };
  organisation: { id: number; name: string | null; level: string | null };
};

export type LoginData = {
  auth: AuthToken;
  /** The member's display name (users.name). */
  name: string;
  /** Already applied to the token when the member holds exactly one cabinet position. */
  position: MemberPosition | null;
  positions: MemberPosition[];
  requires_position_selection: boolean;
};

export type SelectPositionData = { auth: AuthToken; position: MemberPosition };
export type ChangePasswordData = { auth: AuthToken };
export type PositionsData = { positions: MemberPosition[] };

export type OrganisationLevel = { id: number; name: string | null; level: string | null };

export type MemberProfile = {
  membership_no: string;
  name: string | null;
  father_name: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  is_married: boolean | null;
  member_type: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_transferred: boolean;
  contact: {
    mobile_country: string;
    mobile: string;
    country: string | null;
    whatsapp: string | null;
    india_mobile: string | null;
    email: string | null;
  };
  address: {
    gulf_address: string | null;
    city: string | null;
    house_name: string | null;
    place: string | null;
    post_office: string | null;
    district: string | null;
  };
  background: {
    profession: string | null;
    education: string | null;
    islamic_education: string | null;
    blood_group: string | null;
  };
  organisation: {
    unit: OrganisationLevel | null;
    designation: string | null;
    hierarchy: OrganisationLevel[];
    india_unit: string | null;
    india_zone: string | null;
  };
};

/** What we keep about the signed-in member between page loads. */
export type Session = {
  token: string;
  membershipNo: string;
  position: MemberPosition | null;
  positions: MemberPosition[];
  requiresPositionSelection: boolean;
};
