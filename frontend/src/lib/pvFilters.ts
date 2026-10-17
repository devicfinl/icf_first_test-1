import type { AnalysisFilters, AnalysisRange } from "../types/pvAnalysis";

export const RANGE_LABELS: Record<AnalysisRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "1h": "1h",
  "8h": "8h",
  "24h": "24h",
  "7d": "7 days",
  "30d": "30 days",
  campaign: "This campaign",
  custom: "Custom",
};

const CATEGORY = { all: null, new: "New only", renew: "Renewals only" } as const;
const PAYMENT = { all: null, paid: "Paid only", unpaid: "Not paid only" } as const;
const MEMBER = { all: null, yes: "ICF members", no: "Non-members" } as const;

/**
 * The filters in words, for a shared message: the time range (custom shows its dates), then
 * category, payment, ICF member and search when set. Only the keys given are described.
 */
export function describeFilters(
  filters: AnalysisFilters,
  keys: readonly ("range" | "category" | "payment" | "member" | "search")[] = ["range", "category", "payment", "member", "search"],
): string[] {
  const parts: (string | null)[] = [];
  if (keys.includes("range")) {
    parts.push(
      filters.range === "custom" ? `${filters.from ?? "…"} to ${filters.to ?? "…"}` : RANGE_LABELS[filters.range],
    );
  }
  if (keys.includes("category")) parts.push(CATEGORY[filters.category]);
  if (keys.includes("payment")) parts.push(PAYMENT[filters.payment]);
  if (keys.includes("member")) parts.push(MEMBER[filters.member]);
  if (keys.includes("search") && filters.search) parts.push(`Search "${filters.search}"`);
  return parts.filter((part): part is string => part !== null);
}
