import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LegalLinks } from "@/components/LegalPage";

import { fetchProfile, logoutUser } from "../thunks/authThunk";
import type { AppDispatch, RootState } from "../store/store";

/**
 * Where a member lands once a committee position is active. Deliberately thin: it answers "who am
 * I signed in as" and nothing more. The full record lives on /profile.
 */
function DashboardPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { profile, profileLoading, profileError, position, membershipNo } = useSelector(
    (state: RootState) => state.auth,
  );

  // The name is the one thing this page needs, and it is not in the token.
  useEffect(() => {
    if (!profile) void dispatch(fetchProfile());
  }, [dispatch, profile]);

  async function handleSignOut() {
    await dispatch(logoutUser());
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  const name = profile?.name ?? null;
  const initial = name?.trim().charAt(0).toUpperCase();
  const awaitingName = profileLoading && !profile;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-80 rounded-full bg-navy/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-clay/10 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between animate-in fade-in fill-mode-both duration-500 motion-reduce:animate-none">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-navy text-white shadow-lg shadow-navy/15">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-navy">ICF Portal</p>
              <p className="text-xs text-muted-foreground">Member dashboard</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
            <LogOut />
            Sign out
          </Button>
        </header>

        <div className="flex flex-1 flex-col justify-center py-10">
          <Card className="gap-0 overflow-hidden rounded-2xl border-foreground/8 bg-white p-0 shadow-sm animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 motion-reduce:animate-none">
            <div className="h-20 bg-gradient-to-r from-navy to-navy-deep" />

            <div className="flex flex-col items-center px-6 pb-8 text-center">
              <Avatar className="-mt-12 size-24 ring-4 ring-white">
                <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
                <AvatarFallback className="bg-gradient-to-br from-navy to-navy-deep text-3xl font-bold text-white">
                  {initial ?? <UserRound className="size-9" />}
                </AvatarFallback>
              </Avatar>

              {awaitingName ? (
                <Skeleton className="mt-5 h-8 w-56" />
              ) : (
                <h1 className="mt-5 font-heading text-2xl font-bold text-foreground sm:text-3xl">
                  {name ?? membershipNo ?? "Welcome back"}
                </h1>
              )}

              {/* The position chosen at sign-in: the committee context the session acts as. */}
              {position ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Badge className="rounded-full bg-navy px-3.5 py-1.5 text-sm text-white">
                    {position.designation.name}
                  </Badge>
                  {position.organisation.name && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-clay/15 bg-clay/10 px-3.5 py-1.5 text-sm text-clay"
                    >
                      {position.organisation.name}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No committee position is active.</p>
              )}

              <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  onClick={() => navigate("/profile")}
                  className="group/button h-11 rounded-full px-6 shadow-lg shadow-navy/20 transition-all hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <UserRound />
                  View full profile
                  <ArrowRight className="transition-transform duration-200 group-hover/button:translate-x-0.5 motion-reduce:transform-none" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate("/change-password")}
                  className="h-11 rounded-full px-6"
                >
                  <KeyRound />
                  Change password
                </Button>
              </div>
            </div>
          </Card>

          {profileError && !profileLoading && (
            <Alert variant="destructive" className="mt-4 rounded-xl">
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}

          <LegalLinks className="mt-8 justify-center" />
        </div>
      </div>
    </main>
  );
}

export default DashboardPage;
