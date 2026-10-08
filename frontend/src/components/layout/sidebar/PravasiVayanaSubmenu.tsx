import { BookOpen } from "lucide-react";

import SidebarSubmenu from "./SidebarSubmenu";
import type { SidebarEntryProps, SubmenuToggleProps } from "./types";

const ITEMS: { label: string; to: string }[] = [
  { label: "New Subscriber", to: "/pv/new" },
  { label: "Renew Subscriber", to: "/pv/renew" },
  { label: "Public Subscription", to: "/pv/public" },
  { label: "Analytics", to: "/pv/analytics" },
];

/** Pravasi Vayana pages. Only Region, Division and Unit leaders can open them. */
function PravasiVayanaSubmenu({ isLeader, ...props }: SidebarEntryProps & SubmenuToggleProps & { isLeader: boolean }) {
  const items = isLeader ? ITEMS : ITEMS.map(({ label }) => ({ label }));

  return (
    <SidebarSubmenu
      label="Pravasi vayana"
      icon={BookOpen}
      items={items}
      {...props}
    />
  );
}

export default PravasiVayanaSubmenu;
