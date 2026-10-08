import { Link, NavLink, useLocation } from "react-router-dom";

import { COMING_SOON } from "./sidebarStyles";
import { DRAWER_PARAM, withDrawer } from "../../../lib/drawers";
import type { SubmenuItem } from "./types";

// The selected entry gets a lighter tint than its open parent, so the two read as different levels.
const itemClass = (active: boolean) =>
  `block rounded-md px-3 py-2 text-[13px] ${
    active ? "bg-[#fbf7f2] font-medium text-navy" : "text-[#4a4a4a] hover:bg-[#fbf7f2]"
  }`;

/** One entry inside a submenu: a link, or disabled while its page does not exist. */

function SidebarSubmenuItem({ item, onNavigate }: { item: SubmenuItem; onNavigate?: () => void }) {
  const location = useLocation();

  if (item.drawer) {
    const open = new URLSearchParams(location.search).get(DRAWER_PARAM) === item.drawer;
    return (
      <Link to={withDrawer(location, item.drawer)} onClick={onNavigate} className={itemClass(open)}>
        {item.label}
      </Link>
    );
  }

  if (item.to) {
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) => itemClass(isActive)}
      >
        {item.label}
      </NavLink>
    );
  }

  return (
    <span aria-disabled title={COMING_SOON} className="block cursor-not-allowed rounded-md px-3 py-2 text-[13px] text-[#4a4a4a]">
      {item.label}
    </span>
  );
}

export default SidebarSubmenuItem;
