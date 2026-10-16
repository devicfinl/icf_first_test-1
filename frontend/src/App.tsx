import { Theme } from "@radix-ui/themes";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRoute from "./routes/AppRoute";
import { AppProvider } from "./context/AppContext";
import { Toaster } from "sonner";

function App() {

  return (
    <Theme
      //Each screen owns its own background; the sign-in shell brings its own image. 
      className="min-h-screen"
      accentColor="indigo"
      appearance="inherit"
      panelBackground="solid"
      hasBackground={false}
      grayColor="sand"
      radius="large"
    >
      <AppProvider>
        <ErrorBoundary>
          <AppRoute />
        </ErrorBoundary>
        {/* shadcn toasts (Sonner). The app has no dark mode, so the theme is fixed to light. */}
        <Toaster position="top-center" theme="light" richColors closeButton />
      </AppProvider>

    </Theme>

  );
}

export default App;
