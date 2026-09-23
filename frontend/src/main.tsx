import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Theme } from "@radix-ui/themes";
import { Provider } from "react-redux";
import store from "./store/store.ts";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

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
          <Toaster position="top-center" />
          <App />
        </Provider>
      </Theme>
    </BrowserRouter>
  </StrictMode>,
);
