import { configureStore } from "@reduxjs/toolkit";
import authReducer, { sessionExpired } from "../slices/authSlice";
import { setOnExpired } from "../lib/session";

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

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
