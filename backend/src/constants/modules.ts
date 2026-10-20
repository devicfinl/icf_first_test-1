/**
 * Canonical System Module Codes used across access control, permissions, and routing.
 */
export const AppModule = {
  DASHBOARD: "DASHBOARD",
  PV: "PV",
  PV_ANALYTICS: "PV_ANALYTICS",
  PV_SUBSCRIBERS: "PV_SUBSCRIBERS",
  PV_RENEWALS: "PV_RENEWALS",
  PV_PUBLIC: "PV_PUBLIC",
  COMMITTEE: "COMMITTEE",
  ICF_CARE: "ICF_CARE",
  MEETINGS: "MEETINGS",
  SIRAJ: "SIRAJ",
  AYYUHANANAS: "AYYUHANANAS",
  PERFORMANCE_REVIEW: "PERFORMANCE_REVIEW",
  INBOX: "INBOX",
  ORGANIZATION: "ORGANIZATION",
  FORMS: "FORMS",
  MEMBERS: "MEMBERS",
  ACCOUNTS: "ACCOUNTS",
} as const;

export type AppModule = (typeof AppModule)[keyof typeof AppModule];
export type AppModuleCode = AppModule | string;
