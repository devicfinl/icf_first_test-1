import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { RootState } from "../store/store";

/**
 * Guards the signed-in area. A member who holds several committee positions is sent to the picker
 * first: until they choose, their token carries no committee context.
 */
function ProtectedLayout() {
  const { token, requiresPositionSelection } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (!token) {
    // `from` lets the sign-in screen send them back where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requiresPositionSelection) {
    return <Navigate to="/select-position" replace />;
  }

  return <Outlet />;
}

export default ProtectedLayout;
