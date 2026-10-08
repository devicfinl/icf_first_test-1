import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Theme } from "@radix-ui/themes";
import { Provider } from "react-redux";
import store from "./store/store.ts";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Each screen owns its own background; the sign-in shell brings its own image. */}
      <Theme
        className="min-h-screen"
        accentColor="indigo"
        appearance="inherit"
        panelBackground="solid"
        hasBackground={false}
        grayColor="sand"
        radius="large"
      >
        <Provider store={store}>
          {/* shadcn toasts (Sonner). The app has no dark mode, so the theme is fixed to light. */}
          <Toaster position="top-center" theme="light" richColors closeButton />
          <App />
        </Provider>
      </Theme>
    </BrowserRouter>
  </StrictMode>,
);
