import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  BookMarked,
  ChevronLeft,
  ClipboardList,
  Gauge,
  HeartHandshake,
  IdCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Network,
  Newspaper,
  UsersRound,
} from "lucide-react";

import MeetingsSubmenu from "./MeetingsSubmenu";
import PravasiVayanaSubmenu from "./PravasiVayanaSubmenu";
import SettingsSubmenu from "./SettingsSubmenu";
import SidebarLink from "./SidebarLink";
import { usePermissions } from "../../../hooks/usePermissions";
import { AppModule } from "../../../constants/modules";
import { ShieldCheck } from "lucide-react";

type Props = {
  collapsed: boolean;
  /** Desktop only: collapses the sidebar to icons. */
  onToggle?: () => void;
  onNavigate?: () => void;
  onSignOut: () => void;
};

type MenuId = "meetings" | "pv" | "settings";

// The submenu holding the page that is showing, opened on arrival.
function menuFor(pathname: string): MenuId | null {
  if (pathname.startsWith("/pv/")) return "pv";
  if (pathname === "/profile") return "settings";
  return null;
}

/** The sidebar menu: MAIN entries, the SETTINGS section and sign-out. Only one submenu is open at a time. */
function Sidebar({ collapsed, onToggle, onNavigate, onSignOut }: Props) {
  const entry = { collapsed, onNavigate };
  const { pathname } = useLocation();
  const [openMenu, setOpenMenu] = useState<MenuId | null>(() => menuFor(pathname));
  const [shownPath, setShownPath] = useState(pathname);
  const { isSystemAdmin, canRead } = usePermissions();

  // Moving to a page in another submenu (e.g. from a dashboard shortcut) opens that one instead.
  if (pathname !== shownPath) {
    setShownPath(pathname);
    const next = menuFor(pathname);
    if (next) setOpenMenu(next);
  }

  const submenu = (id: MenuId) => ({
    open: openMenu === id,
    onToggle: () => setOpenMenu((current) => (current === id ? null : id)),
  });

  return (
    <div className="flex h-full flex-col">
      <nav
        aria-label="Main"
        className="relative rounded-2xl bg-white px-4 pt-5 pb-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center border-b border-[#eee] px-2 pb-5">
          <img src="/logomain.png" alt="ICF" className={collapsed ? "h-7 w-auto" : "h-10 w-auto"} />
        </div>

        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            className="absolute top-8 -right-3.5 grid size-7 place-items-center rounded-lg bg-white shadow-md"
          >
            <ChevronLeft className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        )}

        {!collapsed && <p className="mt-6 mb-2 px-3 text-[11px] font-medium tracking-wider text-[#555]">MAIN</p>}
        <div className="space-y-1.5">
          <SidebarLink label="Dashboard" icon={LayoutDashboard} to="/dashboard" showChevron {...entry} />
          {canRead(AppModule.COMMITTEE) && <SidebarLink label="Committee" icon={UsersRound} {...entry} />}
          {canRead(AppModule.ICF_CARE) && <SidebarLink label="ICF Care" icon={HeartHandshake} showChevron {...entry} />}
          {canRead(AppModule.MEETINGS) && <MeetingsSubmenu {...entry} {...submenu("meetings")} />}
          {canRead(AppModule.SIRAJ) && <SidebarLink label="Siraj Subcriptions" icon={Newspaper} {...entry} />}
          {canRead(AppModule.PV) && <PravasiVayanaSubmenu {...entry} {...submenu("pv")} />}
          {canRead(AppModule.AYYUHANANAS) && <SidebarLink label="Ayyuhananas" icon={BookMarked} {...entry} />}
          {canRead(AppModule.PERFORMANCE_REVIEW) && <SidebarLink label="Perfomence Review" icon={Gauge} {...entry} />}
          {canRead(AppModule.INBOX) && <SidebarLink label="Inbox" icon={Inbox} {...entry} />}
          {canRead(AppModule.ORGANIZATION) && <SidebarLink label="Organization" icon={Network} {...entry} />}
          {canRead(AppModule.FORMS) && <SidebarLink label="Forms" icon={ClipboardList} {...entry} />}
          {canRead(AppModule.MEMBERS) && <SidebarLink label="Members" icon={IdCard} showChevron {...entry} />}
        </div>
      </nav>

      <div className="mt-5 border-t border-[#ece6df] px-4 pt-5">
        {!collapsed && <p className="mb-2 px-3 text-[11px] font-medium tracking-wider text-[#555]">SETTINGS</p>}
        {isSystemAdmin && (
          <div className="mb-1.5">
            <SidebarLink
              label="Access Control"
              icon={ShieldCheck}
              to="/access-control"
              showChevron
              {...entry}
            />
          </div>
        )}
        <SettingsSubmenu {...entry} {...submenu("settings")} />
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-red-500 hover:bg-red-50"
        >
          <LogOut className="size-5 shrink-0" />
          {!collapsed && "Logout Account"}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
