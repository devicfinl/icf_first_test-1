import { createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  changePassword,
  fetchPositions,
  fetchProfile,
  loginUser,
  logoutUser,
  selectPosition,
} from "../thunks/authThunk";
import { clearSession, getSession } from "../lib/session";
import type { MemberPosition, MemberProfile } from "../types/auth";

type AuthState = {
  /** Null means signed out; every guarded route keys off this. */
  token: string | null;
  membershipNo: string | null;
  /** The committee context this session acts as, once one applies. */
  position: MemberPosition | null;
  positions: MemberPosition[];
  /** True while the member holds several cabinet positions and has not chosen one yet. */
  requiresPositionSelection: boolean;
  profile: MemberProfile | null;
  loading: boolean;
  profileLoading: boolean;
  /** Failures from the auth actions: sign in, position selection, password change. */
  error: string | null;
  /**
   * Kept apart from `error` because the profile is loaded alongside other screens. Not every
   * account has a membership record, and that shouldn't surface as a failure of whatever the
   * member was actually doing.
   */
  profileError: string | null;
};

// Rehydrate from sessionStorage so a refresh keeps the member signed in for as long as the tab
// (and the token) lives. An expired token is discovered on the first request, which 401s and
// clears the session through the axios interceptor.
const stored = getSession();

const initialState: AuthState = {
  token: stored?.token ?? null,
  membershipNo: stored?.membershipNo ?? null,
  position: stored?.position ?? null,
  positions: stored?.positions ?? [],
  requiresPositionSelection: stored?.requiresPositionSelection ?? false,
  profile: null,
  loading: false,
  profileLoading: false,
  error: null,
  profileError: null,
};

function signedOut(state: AuthState): void {
  state.token = null;
  state.membershipNo = null;
  state.position = null;
  state.positions = [];
  state.requiresPositionSelection = false;
  state.profile = null;
  state.loading = false;
  state.profileLoading = false;
  state.profileError = null;
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** The API rejected our token (expired or revoked). Raised by the axios interceptor. */
    sessionExpired(state) {
      signedOut(state);
      state.error = "Your session has ended. Please sign in again.";
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.token = action.payload.auth.token;
        state.membershipNo = action.payload.membershipNo;
        state.position = action.payload.position;
        state.positions = action.payload.positions;
        state.requiresPositionSelection = action.payload.requires_position_selection;
      })

      .addCase(fetchPositions.fulfilled, (state, action) => {
        state.loading = false;
        state.positions = action.payload.positions;
      })

      .addCase(selectPosition.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.token = action.payload.auth.token;
        state.position = action.payload.position;
        state.requiresPositionSelection = false;
      })

      .addCase(changePassword.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        // The server swapped our token for a new one; the old one no longer works.
        state.token = action.payload.auth.token;
      })

      .addCase(fetchProfile.pending, (state) => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.profile = action.payload;
        state.profileError = null;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = action.payload ?? "Could not load your profile";
      })

      .addCase(logoutUser.fulfilled, (state) => {
        signedOut(state);
        state.error = null;
      })

      // Everything else shares one pending/rejected shape, so the forms can read `loading`
      // and `error` without each thunk needing its own three cases.
      .addMatcher(
        isAnyOf(loginUser.pending, fetchPositions.pending, selectPosition.pending, changePassword.pending),
        (state) => {
          state.loading = true;
          state.error = null;
        },
      )
      .addMatcher(
        isAnyOf(
          loginUser.rejected,
          fetchPositions.rejected,
          selectPosition.rejected,
          changePassword.rejected,
        ),
        (state, action: PayloadAction<string | undefined>) => {
          state.loading = false;
          state.error = action.payload ?? "Something went wrong. Please try again.";
        },
      );
  },
});

export const { sessionExpired, clearError } = authSlice.actions;

/**
 * Signs out without calling the API. Use `logoutUser` for a real sign-out: it revokes the token
 * server-side first. This is the escape hatch for a session we already know is dead.
 */
export function forceSignOut() {
  clearSession();
  return sessionExpired();
}

export default authSlice.reducer;
