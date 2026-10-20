import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

import SidebarSubmenu from "./SidebarSubmenu";
import type { SidebarEntryProps, SubmenuToggleProps } from "./types";
import { usePermissions } from "../../../hooks/usePermissions";
import { AppModule } from "../../../constants/modules";

const ALL_ITEMS: { label: string; to: string; code: AppModule }[] = [
  { label: "Analytics", to: "/pv/analytics", code: AppModule.PV_ANALYTICS },
  { label: "Subscribers", to: "/pv/new", code: AppModule.PV_SUBSCRIBERS },
  { label: "Renew Subscribers", to: "/pv/renew", code: AppModule.PV_RENEWALS },
  { label: "Public Subscriptions", to: "/pv/public", code: AppModule.PV_PUBLIC },
];

/** Pravasi Vayana pages, filtered dynamically by module permission. */
function PravasiVayanaSubmenu(props: SidebarEntryProps & SubmenuToggleProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canRead } = usePermissions();

  const items = useMemo(() => {
    return ALL_ITEMS.filter((item) => canRead(item.code) || canRead(AppModule.PV)).map(
      ({ label, to }) => ({ label, to }),
    );
  }, [canRead]);

  // Opening the menu from outside the module lands on the first available page.
  const onToggle = () => {
    props.onToggle();
    if (!props.open && !pathname.startsWith("/pv/")) {
      const firstTarget = items[0]?.to || "/pv/analytics";
      navigate(firstTarget);
    }
  };

  return (
    <SidebarSubmenu
      label="Pravasi vayana"
      icon={BookOpen}
      items={items}
      {...props}
      onToggle={onToggle}
    />
  );
}

export default PravasiVayanaSubmenu;
