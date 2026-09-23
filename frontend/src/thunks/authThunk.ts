import { createAsyncThunk } from "@reduxjs/toolkit";
import api, { apiErrorMessage, unwrap } from "../api/axios";
import { clearSession, setSession, updateToken } from "../lib/session";
import type {
  ApiEnvelope,
  ChangePasswordData,
  LoginData,
  MemberProfile,
  PositionsData,
  SelectPositionData,
} from "../types/auth";

/** Every thunk rejects with a string, so components can render `error` straight from the store. */
type ThunkConfig = { rejectValue: string };

/* -------------------------------------------------- sign in */

export const loginUser = createAsyncThunk<
  LoginData & { membershipNo: string },
  { userName: string; password: string },
  ThunkConfig
>("auth/login", async (credentials, thunkAPI) => {
  try {
    const { data } = await api.post<ApiEnvelope<LoginData>>("/auth/member-login", credentials);
    const result = unwrap(data);

    // Persist immediately: the token has to be on the next request, which may be the profile
    // fetch fired by the page we are about to navigate to.
    setSession({
      token: result.auth.token,
      membershipNo: credentials.userName,
      position: result.position,
      positions: result.positions,
      requiresPositionSelection: result.requires_position_selection,
    });

    return { ...result, membershipNo: credentials.userName };
  } catch (error) {
    return thunkAPI.rejectWithValue(apiErrorMessage(error, "Login failed"));
  }
});

/* -------------------------------------------------- committee position */

export const fetchPositions = createAsyncThunk<PositionsData, void, ThunkConfig>(
  "auth/fetchPositions",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get<ApiEnvelope<PositionsData>>("/auth/positions");
      return unwrap(data);
    } catch (error) {
      return thunkAPI.rejectWithValue(apiErrorMessage(error, "Could not load your committee positions"));
    }
  },
);

export const selectPosition = createAsyncThunk<SelectPositionData, number, ThunkConfig>(
  "auth/selectPosition",
  async (positionId, thunkAPI) => {
    try {
      const { data } = await api.post<ApiEnvelope<SelectPositionData>>("/auth/select-position", {
        positionId,
      });
      const result = unwrap(data);

      // The server revoked the token we sent, so the replacement has to be stored before the next
      // request goes out or it will come back 401.
      updateToken(result.auth.token);

      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue(apiErrorMessage(error, "Could not select that position"));
    }
  },
);

/* -------------------------------------------------- profile */

export const fetchProfile = createAsyncThunk<MemberProfile, void, ThunkConfig>(
  "auth/fetchProfile",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get<ApiEnvelope<{ profile: MemberProfile }>>("/member/profile");
      return unwrap(data).profile;
    } catch (error) {
      return thunkAPI.rejectWithValue(apiErrorMessage(error, "Could not load your profile"));
    }
  },
);

/* -------------------------------------------------- passwords */

export const changePassword = createAsyncThunk<
  ChangePasswordData,
  { currentPassword: string; newPassword: string; confirmPassword: string },
  ThunkConfig
>("auth/changePassword", async (body, thunkAPI) => {
  try {
    const { data } = await api.post<ApiEnvelope<ChangePasswordData>>("/auth/change-password", body);
    const result = unwrap(data);

    // Same as select-position: the old token was revoked in exchange for this one.
    updateToken(result.auth.token);

    return result;
  } catch (error) {
    return thunkAPI.rejectWithValue(apiErrorMessage(error, "Could not change your password"));
  }
});

/* -------------------------------------------------- sign out */

export const logoutUser = createAsyncThunk<true, void, ThunkConfig>(
  "auth/logout",
  async () => {
    try {
      // Revokes the token server-side, so signing out actually ends the session rather than just
      // forgetting it in this tab.
      await api.post<ApiEnvelope<null>>("/auth/logout");
    } catch (error) {
      // A failed revoke should still sign the member out locally — the token expires shortly
      // anyway, and leaving them stuck on a signed-in screen is worse.
      console.warn("Sign out failed server-side:", apiErrorMessage(error, "unknown error"));
    } finally {
      clearSession();
    }
    return true as const;
  },
);
