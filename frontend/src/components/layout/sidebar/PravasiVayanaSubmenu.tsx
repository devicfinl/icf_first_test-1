import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

import SidebarSubmenu from "./SidebarSubmenu";
import type { SidebarEntryProps, SubmenuToggleProps } from "./types";

const ITEMS: { label: string; to: string }[] = [
  { label: "Analytics", to: "/pv/analytics" },
  { label: "Subscribers", to: "/pv/new" },
  { label: "Renew Subscribers", to: "/pv/renew" },
  { label: "Public Subscriptions", to: "/pv/public" },
];

/** Pravasi Vayana pages, open to every signed-in member. The server decides what each may do. */
function PravasiVayanaSubmenu(props: SidebarEntryProps & SubmenuToggleProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Opening the menu from outside the module lands on Analytics.
  const onToggle = () => {
    props.onToggle();
    if (!props.open && !pathname.startsWith("/pv/")) navigate("/pv/analytics");
  };

  return (
    <SidebarSubmenu
      label="Pravasi vayana"
      icon={BookOpen}
      items={ITEMS}
      {...props}
      onToggle={onToggle}
    />
  );
}

export default PravasiVayanaSubmenu;
