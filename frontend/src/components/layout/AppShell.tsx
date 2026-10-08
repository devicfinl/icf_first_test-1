import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import AppHeader from "./AppHeader";
import ChangePasswordDrawer from "../account/ChangePasswordDrawer";
import HierarchyBreadcrumb from "./HierarchyBreadcrumb";
import Sidebar from "./sidebar/Sidebar";
import { isLeaderLevel, positionPath, roleLabel } from "../../lib/organisation";
import { fetchProfile, logoutUser, selectPosition } from "../../thunks/authThunk";
import type { AppDispatch, RootState } from "../../store/store";
import type { MemberPosition } from "../../types/auth";

/**
 * The layout route for every signed-in page: sidebar on the left, header, the position's
 * hierarchy path and the page (the <Outlet/>) on the right. It stays mounted while moving between
 * pages, so the sidebar keeps its state. Owns layout state (collapsed sidebar, phone drawer),
 * switching position and sign-out.
 */
function AppShell() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { profile, position, positions, name, membershipNo, loading } = useSelector((state: RootState) => state.auth);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The name, photo and hierarchy come from the profile, which is not in the token.
  useEffect(() => {
    if (!profile) void dispatch(fetchProfile());
  }, [dispatch, profile]);

  async function handleSignOut() {
    await dispatch(logoutUser());
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  async function handleSwitchPosition(next: MemberPosition) {
    try {
      await dispatch(selectPosition(next.id)).unwrap();
      toast.success(`Switched to ${roleLabel(next.designation.name, next.organisation.level)}`);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not switch position");
    }
  }

  const path = positionPath(profile?.organisation.hierarchy ?? [], position?.organisation.id);
  const isLeader = isLeaderLevel(position?.organisation.level);

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
            isLeader={isLeader}
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
              isLeader={isLeader}
            />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <AppHeader
            name={profile?.name ?? name ?? membershipNo ?? ""}
            role={roleLabel(position?.designation.name, position?.organisation.level)}
            photoUrl={profile?.photo_url ?? null}
            positions={positions}
            currentPositionId={position?.id ?? null}
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
