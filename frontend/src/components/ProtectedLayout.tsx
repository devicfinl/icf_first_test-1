import { Navigate, Outlet, useLocation } from "react-router-dom";
import SessionLoading from "./SessionLoading";
import { useAppContext } from "../context/AppContext";

/**
 * Guards the signed-in area. A member who holds several committee positions is sent to the picker
 * first: until they choose, their token carries no committee context.
 */
function ProtectedLayout() {
  const { session, sessionChecked } = useAppContext();
  const location = useLocation();

  // A stored token is still being verified: deciding now could redirect on a stale answer.
  if (session?.token && !sessionChecked) {
    return <SessionLoading />;
  }

  if (!session?.token) {
    // `from` lets the sign-in screen send them back where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (session.requiresPositionSelection) {
    return <Navigate to="/select-position" replace />;
  }

  return <Outlet />;
}

export default ProtectedLayout;
