import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Avatar, Badge, Box, Button, Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import toast from "react-hot-toast";

import { fetchProfile, logoutUser } from "../thunks/authThunk";
import type { AppDispatch, RootState } from "../store/store";

/** One label/value row; anything the legacy database left blank is simply not shown. */
function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;

  return (
    <Flex justify="between" gap="4" className="py-1.5">
      <Text size="2" color="gray">
        {label}
      </Text>
      <Text size="2" weight="medium" align="right">
        {value}
      </Text>
    </Flex>
  );
}

function Homepage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { profile, profileLoading, position, membershipNo, profileError } = useSelector(
    (state: RootState) => state.auth,
  );

  useEffect(() => {
    if (!profile) void dispatch(fetchProfile());
  }, [dispatch, profile]);

  async function handleSignOut() {
    await dispatch(logoutUser());
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card size="4" className="w-full max-w-lg shadow-lg">
        <Flex direction="column" gap="4">
          <Flex align="center" gap="4">
            <Avatar
              size="5"
              radius="full"
              src={profile?.photo_url ?? undefined}
              fallback={(profile?.name ?? membershipNo ?? "?").charAt(0).toUpperCase()}
            />

            <Box className="min-w-0">
              <Heading size="5" className="truncate">
                {profile?.name ?? "Welcome back"}
              </Heading>
              <Text size="2" color="gray">
                {profile?.membership_no ?? membershipNo}
              </Text>
            </Box>
          </Flex>

          {position && (
            <Flex gap="2" wrap="wrap">
              <Badge color="teal" variant="soft" size="2">
                {position.designation.name}
              </Badge>
              {position.organisation.name && (
                <Badge color="gray" variant="soft" size="2">
                  {position.organisation.name}
                </Badge>
              )}
            </Flex>
          )}

          <Separator size="4" />

          {profileLoading && (
            <Text size="2" color="gray">
              Loading your profile...
            </Text>
          )}

          {profileError && !profileLoading && (
            <Text size="2" className="text-red-600">
              {profileError}
            </Text>
          )}

          {profile && (
            <Box>
              <Detail label="Father's name" value={profile.father_name} />
              <Detail label="Date of birth" value={profile.date_of_birth} />
              <Detail label="Mobile" value={profile.contact.mobile} />
              <Detail label="Email" value={profile.contact.email} />
              <Detail label="Country" value={profile.contact.country} />
              <Detail label="Profession" value={profile.background.profession} />
              <Detail label="Blood group" value={profile.background.blood_group} />
              <Detail label="Unit" value={profile.organisation.unit?.name} />
            </Box>
          )}

          <Separator size="4" />

          <Flex direction="column" gap="3">
            <Button size="3" onClick={() => navigate("/profile")}>
              <UserRound size={16} />
              View full profile
            </Button>

            <Button size="3" variant="soft" onClick={() => navigate("/change-password")}>
              <KeyRound size={16} />
              Change password
            </Button>

            <Button size="3" color="red" variant="soft" onClick={() => void handleSignOut()}>
              <LogOut size={16} />
              Sign out
            </Button>
          </Flex>
        </Flex>
      </Card>
    </main>
  );
}

export default Homepage;
