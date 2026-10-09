// Shared by every sidebar entry, so links and submenus look the same.

/** Shown on entries whose page does not exist yet. */
export const COMING_SOON = "Coming soon";

export const menuItemClass = (active: boolean, enabled: boolean) =>
  [
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
    active ? "bg-[#f3ebe2] font-medium text-navy" : "text-[#3b3b3b]",
    enabled ? "hover:bg-[#f3ebe2]/70" : "cursor-not-allowed",
  ].join(" ");

export const menuIconClass = "size-5 shrink-0 text-[#4a4a4a]";
