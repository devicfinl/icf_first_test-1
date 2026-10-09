import { ChevronDown } from "lucide-react";

import SidebarSubmenuItem from "./SidebarSubmenuItem";
import { menuIconClass, menuItemClass } from "./sidebarStyles";
import type { MenuIcon, SidebarEntryProps, SubmenuItem, SubmenuToggleProps } from "./types";

type Props = SidebarEntryProps &
  SubmenuToggleProps & {
    label: string;
    icon: MenuIcon;
    items: SubmenuItem[];
  };

/** Shared expandable group used by every submenu: a toggle and its list of entries. */
function SidebarSubmenu({ label, icon: Icon, items, open, onToggle, collapsed, onNavigate }: Props) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={menuItemClass(open, true)}
      >
        <Icon className={menuIconClass} />
        {!collapsed && <span className="flex-1 text-left">{label}</span>}
        {!collapsed && (
          <ChevronDown className={`size-4 text-[#4a4a4a] transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && !collapsed && (
        <ul className="ml-[22px] border-l border-[#e7e1da] py-1 pl-3">
          {items.map((item) => (
            <li key={item.label}>
              <SidebarSubmenuItem item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SidebarSubmenu;
