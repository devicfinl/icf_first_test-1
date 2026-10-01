import { configureStore } from "@reduxjs/toolkit";
import authReducer, { sessionExpired, sessionReplaced, signedOutElsewhere } from "../slices/authSlice";
import { onSessionChangedElsewhere, setOnExpired } from "../lib/session";
import { restoreSession } from "../thunks/authThunk";

const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  devTools: import.meta.env.DEV,
});

// The API client cannot import the store (the store imports the thunks, which import the client),
// so it reports an expired token through this callback instead.
setOnExpired(() => {
  store.dispatch(sessionExpired());
});

// Tabs share one stored session, so a sign-in, token swap or sign-out in one is mirrored here.
onSessionChangedElsewhere((session) => {
  store.dispatch(session ? sessionReplaced(session) : signedOutElsewhere());
});

// Verify a stored token once per page load. Dispatched here rather than from a component so
// StrictMode's double-run effects can't send it twice.
if (store.getState().auth.token) {
  void store.dispatch(restoreSession());
}

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
