import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAccessMatrix, type AccessMatrixData } from "../../api/accessControl";
import { apiErrorMessage } from "../../api/axios";
import { useAppContext } from "../../context/AppContext";

export const ACCESS_MATRIX_QUERY_KEY = ["access-control", "matrix"] as const;

export function getAccessMatrixQueryKey(hierarchyLevel?: number, orgId?: number) {
  return [
    ...ACCESS_MATRIX_QUERY_KEY,
    {
      hierarchyLevel: hierarchyLevel ?? 0,
      orgId: orgId ?? 0,
    },
  ] as const;
}

export interface UseAccessMatrixOptions {
  hierarchyLevel?: number;
  orgId?: number;
  enabled?: boolean;
}

export function useAccessMatrix({
  hierarchyLevel = 0,
  orgId = 0,
  enabled = true,
}: UseAccessMatrixOptions = {}) {
  const { session } = useAppContext();
  const queryClient = useQueryClient();
  const isAuthenticated = Boolean(session?.token);

  // When an organisation is selected, hierarchyLevel is overridden to 0 (org-level scope)
  const effectiveHierarchyLevel = orgId > 0 ? 0 : hierarchyLevel;
  const effectiveOrgId = orgId;

  const result = useQuery<AccessMatrixData, Error>({
    queryKey: getAccessMatrixQueryKey(effectiveHierarchyLevel, effectiveOrgId),
    queryFn: () =>
      fetchAccessMatrix({
        hierarchyLevel: effectiveHierarchyLevel,
        orgId: effectiveOrgId,
      }),
    enabled: isAuthenticated && enabled,
  });

  const matrixError = result.error
    ? apiErrorMessage(result.error, "Failed to load access control matrix")
    : null;

  return {
    ...result,
    matrix: result.data ?? null,
    matrixLoading: result.isLoading,
    matrixFetching: result.isFetching,
    matrixError,
    invalidateMatrix: () =>
      queryClient.invalidateQueries({ queryKey: ACCESS_MATRIX_QUERY_KEY }),
  };
}

export default useAccessMatrix;
