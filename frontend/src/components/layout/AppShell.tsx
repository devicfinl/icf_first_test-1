import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import AppHeader from "./AppHeader";
import ChangePasswordDrawer from "../account/ChangePasswordDrawer";
import HierarchyBreadcrumb from "./HierarchyBreadcrumb";
import Sidebar from "./sidebar/Sidebar";
import { positionPath, roleLabel } from "../../lib/organisation";
import { useAppContext } from "../../context/AppContext";
import type { MemberPosition } from "../../types/auth";

/**
 * The layout route for every signed-in page: sidebar on the left, header, the position's
 * hierarchy path and the page (the <Outlet/>) on the right. It stays mounted while moving between
 * pages, so the sidebar keeps its state. Owns layout state (collapsed sidebar, phone drawer),
 * switching position and sign-out.
 */
function AppShell() {
  const navigate = useNavigate();
  const {
    session,
    profile,
    loading,
    fetchProfile,
    logout,
    selectPosition,
  } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The name, photo and hierarchy come from the profile, which is not in the token.
  useEffect(() => {
    if (!profile) void fetchProfile();
  }, [fetchProfile, profile]);

  async function handleSignOut() {
    await logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  async function handleSwitchPosition(next: MemberPosition) {
    try {
      await selectPosition(next.id);
      toast.success(`Switched to ${roleLabel(next.designation.name, next.organisation.level)}`);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not switch position");
    }
  }

  const path = positionPath(profile?.organisation.hierarchy ?? [], session?.position?.organisation.id);

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1f1f]">
      <div className="flex gap-6 p-4 lg:gap-[46px] lg:px-[25px] lg:pt-[43px] lg:pb-10">
        {/* Desktop sidebar: stays in view while the page scrolls, and scrolls on its own when the
            menu is taller than the screen. The 16px right padding, cancelled by the negative
            margin, keeps the collapse button from being clipped. */}
        <aside
          className={`hidden shrink-0 transition-[width] [scrollbar-width:none] lg:sticky lg:top-0 lg:-my-[43px] lg:-mr-4 lg:block lg:h-screen lg:self-start lg:overflow-y-auto lg:py-[43px] lg:pr-4 ${
            collapsed ? "w-[104px]" : "w-[271px]"
          }`}
        >
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
            onSignOut={() => void handleSignOut()}
          />
        </aside>

        {/* Phone and tablet: the same menu in a drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[290px] overflow-y-auto bg-[#f7f3ee] p-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Sidebar
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={() => void handleSignOut()}
              />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <AppHeader
            name={profile?.name ?? session?.name ?? session?.membershipNo ?? ""}
            role={roleLabel(session?.position?.designation.name, session?.position?.organisation.level)}
            photoUrl={profile?.photo_url ?? null}
            positions={session?.positions ?? []}
            currentPositionId={session?.position?.id ?? null}
            switching={loading}
            onSwitchPosition={(next) => void handleSwitchPosition(next)}
            onViewProfile={() => navigate("/profile")}
            onSignOut={() => void handleSignOut()}
            onOpenMenu={() => setMobileOpen(true)}
            leading={path.length > 0 && <HierarchyBreadcrumb path={path} />}
          />

          <div className="mt-6 lg:mt-8 lg:mr-[23px]">
            <Outlet />
            <ChangePasswordDrawer />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
