import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { RANGES, type AnalysisFilters, type AnalysisRange, type SubscriptionSort } from "../types/pvAnalysis";

export const ANALYSIS_TABS = [
  { id: "overview", label: "Overview" },
  { id: "competition", label: "Competition" },
  { id: "participation", label: "Participation" },
  { id: "payment", label: "Payment" },
  { id: "old", label: "Old Subscribers" },
  { id: "new", label: "New Subscribers" },
  { id: "growth", label: "Growth" },
] as const;
export type AnalysisTab = (typeof ANALYSIS_TABS)[number]["id"];

const SORTS: readonly SubscriptionSort[] = ["created_at", "updated_at", "name", "amount", "mode", "category"];
const PAGE_SIZES = [25, 50, 100] as const;

// The default of each URL parameter: it is left out of the URL.
const DEFAULTS = {
  tab: "overview",
  range: "campaign",
  category: "all",
  payment: "all",
  member: "all",
  status: "approved",
  sort: "created_at",
  dir: "desc",
  page: "1",
  page_size: "25",
} as const;

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const positive = (value: string | null) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

export type AnalysisParamsPatch = Partial<Record<keyof typeof DEFAULTS | "year" | "org_id" | "from" | "to" | "search", string | number | undefined>>;

/**
 * The Analysis page's tab, filters, sort and page, kept in the URL (e.g. ?tab=all&category=renew&range=7d)
 * so a view can be shared or reloaded. Changing anything but the page goes back to page 1.
 */
export function useAnalysisParams() {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const filters: AnalysisFilters = {
      year: positive(params.get("year")),
      orgId: positive(params.get("org_id")),
      range: pick<AnalysisRange>(params.get("range"), RANGES, "campaign"),
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      category: pick(params.get("category"), ["all", "new", "renew"] as const, "all"),
      payment: pick(params.get("payment"), ["all", "paid", "unpaid"] as const, "all"),
      member: pick(params.get("member"), ["all", "yes", "no"] as const, "all"),
      status: pick(params.get("status"), ["approved", "pending", "rejected", "all"] as const, "approved"),
      search: params.get("search") ?? undefined,
    };
    return {
      tab: pick<AnalysisTab>(params.get("tab"), ANALYSIS_TABS.map((tab) => tab.id), "overview"),
      filters,
      sort: pick(params.get("sort"), SORTS, "created_at"),
      dir: pick(params.get("dir"), ["asc", "desc"] as const, "desc"),
      page: positive(params.get("page")) ?? 1,
      pageSize: Number(pick(params.get("page_size"), PAGE_SIZES.map(String), "25")),
    };
  }, [params]);

  const update = useCallback(
    (patch: AnalysisParamsPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            const text = value === undefined ? "" : String(value);
            if (text === "" || DEFAULTS[key as keyof typeof DEFAULTS] === text) next.delete(key);
            else next.set(key, text);
          }
          if (!("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Filters that differ from their default, for the "n active" count.
  const { filters } = state;
  const activeFilters =
    Number(filters.range !== "campaign") +
    Number(filters.category !== "all") +
    Number(filters.payment !== "all") +
    Number(filters.member !== "all") +
    Number(filters.status !== "approved") +
    Number(Boolean(filters.search));

  const resetFilters = useCallback(
    () =>
      update({ range: undefined, from: undefined, to: undefined, category: undefined, payment: undefined, member: undefined, status: undefined, search: undefined }),
    [update],
  );

  return { ...state, update, activeFilters, resetFilters };
}
