import type { MouseEvent } from "react";

/** The subscriber view page for one year's subscription. */
export const subscriberPath = (subscriberId: number, year: number | null | undefined) =>
  `/pv/subscribers/${subscriberId}${year ? `?year=${year}` : ""}`;

/** Table row classes for rows that open the view page when clicked. */
export const clickableRowClass = "cursor-pointer border-b border-[#eee] transition-colors hover:bg-[#fbf7f2]";

/**
 * A row click opens the view page, except clicks on the row's own controls (buttons, links),
 * which do their own thing.
 */
export function onRowClick(go: () => void) {
  return (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    go();
  };
}
