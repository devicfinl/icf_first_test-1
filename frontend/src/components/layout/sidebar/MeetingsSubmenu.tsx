import { CalendarClock } from "lucide-react";

import SidebarSubmenu from "./SidebarSubmenu";
import type { SidebarEntryProps, SubmenuItem, SubmenuToggleProps } from "./types";

// None of these pages exist yet, so each entry is disabled until it gets a route.
const MEETINGS_ITEMS: SubmenuItem[] = [
  { label: "Add E-Minutes" },
  { label: "E-Minutes Actions" },
  { label: "Attendence Report" },
  { label: "Old E-Minutes" },
  { label: "Payouts" },
];

function MeetingsSubmenu(props: SidebarEntryProps & SubmenuToggleProps) {
  return <SidebarSubmenu label="Meetings" icon={CalendarClock} items={MEETINGS_ITEMS} {...props} />;
}

export default MeetingsSubmenu;
