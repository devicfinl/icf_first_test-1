import { useState, type ReactNode } from "react";
import { Check, ChevronDown, LogOut, Menu, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { roleLabel } from "../../lib/organisation";
import type { MemberPosition } from "../../types/auth";

type Props = {
  name: string;
  /** e.g. "Unit Secretary"; empty when the session has no position. */
  role: string;
  photoUrl: string | null;
  positions: MemberPosition[];
  currentPositionId: number | null;
  /** True while a position switch is in flight. */
  switching: boolean;
  onSwitchPosition: (position: MemberPosition) => void;
  onViewProfile: () => void;
  onSignOut: () => void;
  /** Opens the menu drawer on phone and tablet widths. */
  onOpenMenu: () => void;
  /** Shown on the left, e.g. the hierarchy breadcrumb. */
  leading?: ReactNode;
};

/** The header card: who is signed in and the role they are acting as, with a hover box to switch it. */
function AppHeader({
  name,
  role,
  photoUrl,
  positions,
  currentPositionId,
  switching,
  onSwitchPosition,
  onViewProfile,
  onSignOut,
  onOpenMenu,
  leading,
}: Props) {
  // Controlled so a tap opens it too: hover cards ignore touch.
  const [open, setOpen] = useState(false);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <header className="flex  items-center gap-3 rounded-2xl bg-[#f3ebe2] px-4 shadow-[0_8px_16px_rgba(0,0,0,0.08)] sm:py-2">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/70 lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">{leading}</div>

      <HoverCard open={open} onOpenChange={setOpen} openDelay={100} closeDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex shrink-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/60"
          >
            <Avatar className="size-11">
              <AvatarImage src={photoUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-navy text-white">{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {/* Phones keep just the avatar, leaving room for the hierarchy. */}
            <div className="hidden sm:block">
              {role && <p className="text-[11px] tracking-wide text-[#6b6b6b]">{role}</p>}
              <p className="text-[15px] font-medium">{name}</p>
            </div>
            <ChevronDown className={`hidden size-4 text-[#6b6b6b] transition-transform sm:block ${open ? "rotate-180" : ""}`} />
          </button>
        </HoverCardTrigger>

        <HoverCardContent align="end" sideOffset={8} className="w-72 rounded-xl p-2">
          {positions.length > 1 && (
            <>
              <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-[#6b6b6b] uppercase">
                Switch position
              </p>
              <ul role="menu" className="space-y-0.5">
                {positions.map((position) => {
                  const current = position.id === currentPositionId;
                  return (
                    <li key={position.id}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={current || switching}
                        onClick={() => run(() => onSwitchPosition(position))}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[#f3ebe2] disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {roleLabel(position.designation.name, position.organisation.level)}
                          </p>
                          {position.organisation.name && (
                            <p className="truncate text-xs text-[#6b6b6b]">{position.organisation.name}</p>
                          )}
                        </div>
                        {current && <Check className="size-4 shrink-0 text-[#8A481B]" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="my-2 h-px bg-[#e7e2d9]" />
            </>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onViewProfile)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[#f3ebe2]"
          >
            <UserRound className="size-4" />
            View profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onSignOut)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </HoverCardContent>
      </HoverCard>
    </header>
  );
}

export default AppHeader;
