import type { ComponentType } from "react";

export type MenuIcon = ComponentType<{ className?: string }>;

/** An entry inside a submenu. Without `to` its page does not exist yet, so it is disabled. */
export type SubmenuItem = {
  label: string;
  to?: string;
  /** Opens this app-wide drawer over the current page instead of going to a page. */
  drawer?: string;
};

/** What every sidebar entry receives from the sidebar. */
export type SidebarEntryProps = {
  /** Icon-only sidebar: labels, chevrons and submenu items are hidden. */
  collapsed: boolean;
  /** Called after following a link (closes the phone drawer). */
  onNavigate?: () => void;
};

/** A submenu's open state, held by the sidebar so that only one submenu is open at a time. */
export type SubmenuToggleProps = {
  open: boolean;
  onToggle: () => void;
};
