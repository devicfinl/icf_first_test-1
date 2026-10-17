import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiErrorMessage, unwrap } from "../../api/axios";
import { useAppContext } from "../../context/AppContext";
import type { ApiEnvelope, MemberProfile } from "../../types/auth";

export const PROFILE_QUERY_KEY = ["profile"] as const;

export async function fetchProfileApi(): Promise<MemberProfile> {
  const { data } = await api.get<ApiEnvelope<{ profile: MemberProfile }>>("/member/profile");
  return unwrap(data).profile;
}

export interface UseProfileOptions {
  enabled?: boolean;
}

export function useProfile({ enabled = true }: UseProfileOptions = {}) {
  const { session } = useAppContext();
  const queryClient = useQueryClient();
  const isAuthenticated = Boolean(session?.token);

  const result = useQuery<MemberProfile, Error>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfileApi,
    enabled: isAuthenticated && enabled,
  });

  const profileError = result.error
    ? apiErrorMessage(result.error, "Could not load your profile")
    : null;

  return {
    ...result,
    profile: result.data ?? null,
    profileLoading: result.isLoading,
    profileError,
    invalidateProfile: () =>
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  };
}

export default useProfile;
