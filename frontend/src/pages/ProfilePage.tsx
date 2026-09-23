import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, UserRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ProfileDetails,
  ProfileDetailsSkeleton,
  ProfileStatusBadges,
} from "@/components/ProfileDetails";

import { fetchProfile } from "../thunks/authThunk";
import type { AppDispatch, RootState } from "../store/store";

/** The signed-in member's own record, read-only. Editing lives in the legacy admin, not here. */
function ProfilePage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { profile, profileLoading, profileError, position, membershipNo } = useSelector(
    (state: RootState) => state.auth,
  );

  useEffect(() => {
    if (!profile) void dispatch(fetchProfile());
  }, [dispatch, profile]);

  const name = profile?.name ?? null;
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-80 rounded-full bg-navy/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-clay/10 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="group/button -ml-2.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="transition-transform duration-200 group-hover/button:-translate-x-0.5 motion-reduce:transform-none" />
          Back to dashboard
        </Button>

        <Card className="mt-4 gap-0 overflow-hidden rounded-2xl border-foreground/8 bg-white p-0 shadow-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none">
          <div className="h-20 bg-gradient-to-r from-navy to-navy-deep" />

          <div className="px-5 pb-5">
            <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <Avatar className="size-20 ring-4 ring-white sm:size-24">
                  <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-navy to-navy-deep text-2xl font-bold text-white">
                    {initial ?? <UserRound className="size-8" />}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 pb-1">
                  <h1 className="truncate font-heading text-xl font-bold text-foreground sm:text-2xl">
                    {name ?? "Member profile"}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {profile?.membership_no ?? membershipNo}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:pb-1">
                <Button variant="outline" size="sm" onClick={() => navigate("/change-password")}>
                  <KeyRound />
                  Change password
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {position && (
                <Badge className="rounded-full bg-navy px-3 py-1 text-white">
                  {position.designation.name}
                </Badge>
              )}
              {position?.organisation.name && (
                <Badge
                  variant="outline"
                  className="rounded-full border-clay/15 bg-clay/10 px-3 py-1 text-clay"
                >
                  {position.organisation.name}
                </Badge>
              )}
              <ProfileStatusBadges profile={profile} />
            </div>
          </div>
        </Card>

        {profileError && !profileLoading && (
          <Alert variant="destructive" className="mt-4 rounded-xl">
            <AlertDescription>{profileError}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4">
          {profileLoading && !profile ? (
            <ProfileDetailsSkeleton />
          ) : profile ? (
            <ProfileDetails profile={profile} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default ProfilePage;
