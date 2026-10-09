import { Settings } from "lucide-react";

import SidebarSubmenu from "./SidebarSubmenu";
import { CHANGE_PASSWORD_DRAWER } from "../../../lib/drawers";
import type { SidebarEntryProps, SubmenuItem, SubmenuToggleProps } from "./types";

const SETTINGS_ITEMS: SubmenuItem[] = [
  { label: "Profile", to: "/profile" },
  { label: "Change password", drawer: CHANGE_PASSWORD_DRAWER },
];

function SettingsSubmenu(props: SidebarEntryProps & SubmenuToggleProps) {
  return <SidebarSubmenu label="Settings" icon={Settings} items={SETTINGS_ITEMS} {...props} />;
}

export default SettingsSubmenu;
