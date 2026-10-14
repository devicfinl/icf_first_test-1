import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, ChevronRight, KeyRound, RefreshCw, Share2, UserPlus, UserRound, type LucideIcon } from "lucide-react";

import { CHANGE_PASSWORD_DRAWER, withDrawer } from "../lib/drawers";
import { roleLabel } from "../lib/organisation";
import type { RootState } from "../store/store";

type Shortcut = { label: string; hint: string; to: string; icon: LucideIcon };

const PV_SHORTCUTS: Shortcut[] = [
  { label: "New Subscriber", hint: "Register a Pravasi Vayana subscriber", to: "/pv/new", icon: UserPlus },
  { label: "Renew Subscriber", hint: "Last year's subscribers to renew", to: "/pv/renew", icon: RefreshCw },
  { label: "Public Subscription", hint: "Share your link, approve entries", to: "/pv/public", icon: Share2 },
  { label: "Analytics", hint: "Work progress for your area", to: "/pv/analytics", icon: BarChart3 },
];

function ShortcutCard({ shortcut }: { shortcut: Shortcut }) {
  const Icon = shortcut.icon;
  return (
    <Link
      to={shortcut.to}
      className="group flex items-center gap-3 rounded-xl border border-[#ece6df] bg-white px-4 py-3 transition-colors hover:bg-[#faf7f3]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f3ebe2] text-clay">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-navy">{shortcut.label}</span>
        <span className="block truncate text-[12px] text-[#6b6b6b]">{shortcut.hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[#b0a89e] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * Where a member lands once a committee position is active: a greeting and shortcuts to what
 * the position can do. Sections without data behind them yet (meetings, reports) are left out.
 */
function DashboardPage() {
  const location = useLocation();
  const { profile, name, position } = useSelector((state: RootState) => state.auth);
  const displayName = profile?.name ?? name ?? "";
  const role = roleLabel(position?.designation.name, position?.organisation.level);

  const account: Shortcut[] = [
    { label: "My profile", hint: "Your membership details", to: "/profile", icon: UserRound },
    { label: "Change password", hint: "Update your sign-in password", to: withDrawer(location, CHANGE_PASSWORD_DRAWER), icon: KeyRound },
  ];

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white px-5 py-6 sm:px-7">
        <h1 className="text-[22px] font-semibold text-navy">Welcome{displayName ? `, ${displayName}` : ""}</h1>
        {role && (
          <p className="mt-1 text-[14px] text-[#6b6b6b]">
            {role}
            {position?.organisation.name ? ` · ${position.organisation.name}` : ""}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 px-1 text-[13px] font-semibold tracking-wide text-[#6b6b6b] uppercase">Pravasi Vayana</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PV_SHORTCUTS.map((shortcut) => (
            <ShortcutCard key={shortcut.to} shortcut={shortcut} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-[13px] font-semibold tracking-wide text-[#6b6b6b] uppercase">Account</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {account.map((shortcut) => (
            <ShortcutCard key={shortcut.label} shortcut={shortcut} />
          ))}
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
