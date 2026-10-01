import { Navigate, Route, Routes } from "react-router-dom";

import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedLayout from "./components/ProtectedLayout";
import LoginPage from "./pages/LoginPage";
import SelectPositionPage from "./pages/SelectPositionPage";
import Homepage from "./pages/Homepage";
import ChangePassword from "./pages/ChangePassword";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import SupportPage from "./pages/SupportPage";
import DeleteAccountPage from "./pages/DeleteAccountPage";

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Signed out */}
        <Route path="/login" element={<LoginPage />} />

        {/* Public either way. These paths are listed in the app stores, so keep them stable. */}
        <Route path="/privacyPolicy" element={<PrivacyPolicyPage />} />
        <Route path="/termsAndConditions" element={<TermsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/deleteAccount" element={<DeleteAccountPage />} />
        {/* Earlier paths, kept so old links still work. */}
        <Route path="/privacy-policy" element={<Navigate to="/privacyPolicy" replace />} />
        <Route path="/terms" element={<Navigate to="/termsAndConditions" replace />} />

        {/* Needs a token, but runs before a committee position has been chosen. */}
        <Route path="/select-position" element={<SelectPositionPage />} />

        {/* Signed in */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Homepage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
