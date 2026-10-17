import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, { apiErrorMessage, unwrap } from "../api/axios";
import {
  clearSession,
  getSession,
  getToken,
  onSessionChangedElsewhere,
  setOnExpired,
  setSession,
} from "../lib/session";
import queryClient from "../lib/queryClient";
import { PROFILE_QUERY_KEY } from "../hooks/data/useProfile";
import type {
  ApiEnvelope,
  ChangePasswordData,
  CurrentSessionData,
  LoginData,
  PositionsData,
  SelectPositionData,
  Session,
} from "../types/auth";

export interface AppContextType {
  session: Session | null;
  sessionChecked: boolean;
  loading: boolean;
  error: string | null;

  login: (credentials: { userName: string; password: string }) => Promise<LoginData & { membershipNo: string }>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<CurrentSessionData | null>;
  fetchPositions: () => Promise<PositionsData>;
  selectPosition: (positionId: number) => Promise<SelectPositionData>;
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<ChangePasswordData>;
  cancelAccount: (data: { currentPassword: string; confirm: true }) => Promise<void>;
  clearError: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => {
    const stored = getSession();
    if (!stored) return null;
    return {
      ...stored,
      requiresPositionSelection: !stored.position && stored.requiresPositionSelection,
    };
  });
  const [sessionChecked, setSessionChecked] = useState<boolean>(!getSession());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const restoredRef = useRef(false);

  const handleSignedOut = useCallback(() => {
    setSessionState(null);
    setSessionChecked(true);
    setLoading(false);
    queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
  }, []);

  const restoreSession = useCallback(async (): Promise<CurrentSessionData | null> => {
    try {
      const { data } = await api.get<ApiEnvelope<CurrentSessionData>>("/auth/me");
      const result = unwrap(data);

      const needsPositionSelection = !result.position && result.positions.length > 1;
      const currentToken = getToken();
      if (currentToken) {
        const nextSession: Session = {
          token: currentToken,
          membershipNo: result.membership_no,
          name: result.name,
          position: result.position,
          positions: result.positions,
          requiresPositionSelection: needsPositionSelection,
        };
        setSession(nextSession);
        setSessionState(nextSession);
      }

      setSessionChecked(true);
      return result;
    } catch {
      // A 401 has already signed the member out via axios interceptor; anything else keeps the stored session.
      setSessionChecked(true);
      return null;
    }
  }, []);

  // Verify stored token once on app load
  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      if (session?.token) {
        void restoreSession();
      }
    }
  }, [restoreSession, session?.token]);

  // Handle 401 expired session reported by axios interceptor
  useEffect(() => {
    setOnExpired(() => {
      handleSignedOut();
      setError("Your session has ended. Please sign in again.");
    });
  }, [handleSignedOut]);

  // Tabs share one stored session, so a sign-in, token swap or sign-out in one is mirrored here
  useEffect(() => {
    onSessionChangedElsewhere((newSession) => {
      if (newSession) {
        setSessionState(newSession);
        setSessionChecked(true);
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      } else {
        handleSignedOut();
        setError(null);
      }
    });
  }, [handleSignedOut]);

  const login = useCallback(
    async (credentials: { userName: string; password: string }): Promise<LoginData & { membershipNo: string }> => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.post<ApiEnvelope<LoginData>>("/auth/member-login", credentials);
        const result = unwrap(data);

        const needsPositionSelection = !result.position && result.positions.length > 1;
        const nextSession: Session = {
          token: result.auth.token,
          membershipNo: credentials.userName,
          name: result.name,
          position: result.position,
          positions: result.positions,
          requiresPositionSelection: needsPositionSelection,
        };

        setSession(nextSession);
        setSessionState(nextSession);
        setSessionChecked(true);

        return { ...result, membershipNo: credentials.userName };
      } catch (err) {
        const msg = apiErrorMessage(err, "Login failed");
        setError(msg);
        throw msg;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchPositions = useCallback(async (): Promise<PositionsData> => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get<ApiEnvelope<PositionsData>>("/auth/positions");
      const result = unwrap(data);
      setSessionState((prev) => {
        if (!prev) return null;
        const next: Session = { ...prev, positions: result.positions };
        setSession(next);
        return next;
      });
      return result;
    } catch (err) {
      const msg = apiErrorMessage(err, "Could not load your committee positions");
      setError(msg);
      throw msg;
    } finally {
      setLoading(false);
    }
  }, []);

  const selectPosition = useCallback(async (positionId: number): Promise<SelectPositionData> => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.post<ApiEnvelope<SelectPositionData>>("/auth/select-position", {
        positionId,
      });
      const result = unwrap(data);

      setSessionState((prev) => {
        if (!prev) return null;
        const next: Session = {
          ...prev,
          token: result.auth.token,
          position: result.position,
          requiresPositionSelection: false,
        };
        setSession(next);
        return next;
      });

      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });

      return result;
    } catch (err) {
      const msg = apiErrorMessage(err, "Could not select that position");
      setError(msg);
      throw msg;
    } finally {
      setLoading(false);
    }
  }, []);

  const changePassword = useCallback(
    async (body: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }): Promise<ChangePasswordData> => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.post<ApiEnvelope<ChangePasswordData>>("/auth/change-password", body);
        const result = unwrap(data);

        setSessionState((prev) => {
          if (!prev) return null;
          const next = { ...prev, token: result.auth.token };
          setSession(next);
          return next;
        });

        return result;
      } catch (err) {
        const msg = apiErrorMessage(err, "Could not change your password");
        setError(msg);
        throw msg;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const cancelAccount = useCallback(
    async (body: { currentPassword: string; confirm: true }): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await api.post<ApiEnvelope<null>>("/auth/cancel-account", body);
        clearSession();
        handleSignedOut();
      } catch (err) {
        const msg = apiErrorMessage(err, "Could not cancel your account");
        setError(msg);
        throw msg;
      } finally {
        setLoading(false);
      }
    },
    [handleSignedOut],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post<ApiEnvelope<null>>("/auth/logout");
    } catch (err) {
      console.warn("Sign out failed server-side:", apiErrorMessage(err, "unknown error"));
    } finally {
      clearSession();
      handleSignedOut();
    }
  }, [handleSignedOut]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AppContextType>(
    () => ({
      session,
      sessionChecked,
      loading,
      error,
      login,
      logout,
      restoreSession,
      fetchPositions,
      selectPosition,
      changePassword,
      cancelAccount,
      clearError,
    }),
    [
      session,
      sessionChecked,
      loading,
      error,
      login,
      logout,
      restoreSession,
      fetchPositions,
      selectPosition,
      changePassword,
      cancelAccount,
      clearError,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
