import { ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";

import { COMING_SOON, menuIconClass, menuItemClass } from "./sidebarStyles";
import type { MenuIcon, SidebarEntryProps } from "./types";

type Props = SidebarEntryProps & {
  label: string;
  icon: MenuIcon;
  /** Without a route the entry is shown but disabled. */
  to?: string;
  /** The design shows a chevron on some entries even before they have sub-items. */
  showChevron?: boolean;
};

/** A top-level sidebar entry: a link to its page, or a disabled placeholder. */
function SidebarLink({ label, icon: Icon, to, showChevron = false, collapsed, onNavigate }: Props) {
  const content = (
    <>
      <Icon className={menuIconClass} />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && showChevron && <ChevronDown className="size-4 text-[#4a4a4a]" />}
    </>
  );

  if (to) {
    return (
      <NavLink to={to} onClick={onNavigate} className={({ isActive }) => menuItemClass(isActive, true)}>
        {content}
      </NavLink>
    );
  }

  return (
    <button type="button" aria-disabled title={COMING_SOON} className={menuItemClass(false, false)}>
      {content}
    </button>
  );
}

export default SidebarLink;
