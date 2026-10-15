import type { SessionPosition } from "../utils/jwt.js";

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  OFFICE_ADMIN = "OFFICE_ADMIN",
  MEMBER = "MEMBER",
  CABINET = "CABINET",
  PRESIDENT = "PRESIDENT",
  VICE_PRESIDENT = "VICE_PRESIDENT",
  GENERAL_SECRETARY = "GENERAL_SECRETARY",
  FINANCE_SECRETARY = "FINANCE_SECRETARY",
  SECRETARY = "SECRETARY",
}

export enum SystemRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  OFFICE_ADMIN = "OFFICE_ADMIN",
  MEMBER = "MEMBER",
}

export interface ActivePositionContext {
  cmid: number;
  desid: number;
  desigName: string;
  orgId: number;
  orgName?: string | null;
  levelName?: string | null;
}

export interface AuthUser {
  userId: string;
  userName?: string;
  name?: string;
  memberNo?: string;
  roles?: string[];
  role?: string;
  position: SessionPosition | null;
  activePosition?: ActivePositionContext | null;
  isOfficeUser?: boolean;
  isSystemAdmin?: boolean;
  systemRole?: SystemRole;
  jti: string;
  exp: number;
}
