import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedLayout from "../components/ProtectedLayout";
import AppShell from "../components/layout/AppShell";
import LoginPage from "../pages/LoginPage";
import SelectPositionPage from "../pages/SelectPositionPage";
import Homepage from "../pages/Homepage";
import ProfilePage from "../pages/ProfilePage";
import DashboardPage from "../pages/DashboardPage";
import PrivacyPolicyPage from "../pages/PrivacyPolicyPage";
import TermsPage from "../pages/TermsPage";
import SupportPage from "../pages/SupportPage";
import DeleteAccountPage from "../pages/DeleteAccountPage";
import PvNewSubscribersPage from "../pages/PvNewSubscribersPage";
import PvRenewPage from "../pages/PvRenewPage";
import PvPublicPage from "../pages/PvPublicPage";
import PvAnalyticsPage from "../pages/PvAnalyticsPage";
import PvSubscriberPage from "../pages/PvSubscriberPage";
import PublicSubscriptionPage from "../pages/PublicSubscriptionPage";

function AppRoute() {
  return (
    <Routes>
      {/* Signed out */}
      <Route path="/login" element={<LoginPage />} />

      {/* Public either way. These paths are listed in the app stores, so keep them stable. */}
      <Route path="/privacyPolicy" element={<PrivacyPolicyPage />} />
      <Route path="/termsAndConditions" element={<TermsPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/deleteAccount" element={<DeleteAccountPage />} />
      {/* A leader's shared Pravasi Vayana registration link: anyone can subscribe through it. */}
      <Route path="/pv/register/:rootId" element={<PublicSubscriptionPage />} />
      {/* Earlier paths, kept so old links still work. */}
      <Route path="/privacy-policy" element={<Navigate to="/privacyPolicy" replace />} />
      <Route path="/terms" element={<Navigate to="/termsAndConditions" replace />} />

      {/* Needs a token, but runs before a committee position has been chosen. */}
      <Route path="/select-position" element={<SelectPositionPage />} />

      {/* Signed in: every page sits to the right of the sidebar (AppShell). */}
      <Route element={<ProtectedLayout />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Homepage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Change password is a drawer now (?drawer=change-password); kept so old links still work. */}
          <Route path="/change-password" element={<Navigate to="/dashboard?drawer=change-password" replace />} />
          <Route path="/pv/new" element={<PvNewSubscribersPage />} />
          <Route path="/pv/renew" element={<PvRenewPage />} />
          <Route path="/pv/public" element={<PvPublicPage />} />
          <Route path="/pv/analytics" element={<PvAnalyticsPage />} />
          <Route path="/pv/subscribers/:subscriberId" element={<PvSubscriberPage />} />
          {/* Earlier paths, kept so old links still work. */}
          <Route path="/pv" element={<Navigate to="/pv/new" replace />} />
          <Route path="/pv/subscribers/new" element={<Navigate to="/pv/new" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoute;
