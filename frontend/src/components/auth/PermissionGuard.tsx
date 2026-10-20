import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { usePermissions, type PermissionAction } from "../../hooks/usePermissions";
import { ShieldAlert } from "lucide-react";

export interface PermissionGuardProps {
  module: string;
  action?: PermissionAction;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Route-level guard that checks if the active session holds permission
 * for the requested module and action.
 */
export function PermissionGuard({
  module,
  action = "read",
  fallback,
  children,
  redirectTo = "/dashboard",
}: PermissionGuardProps) {
  const { can } = usePermissions();

  if (!can(module, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return (
      <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Access Restricted</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          Your active committee position does not have permission to access the{" "}
          <span className="font-semibold">{module}</span> module. Please contact your organization administrator.
        </p>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export interface CanProps {
  module: string;
  action?: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component-level guard for conditional rendering of actions (e.g. Add, Edit, Delete buttons).
 */
export function Can({ module, action = "read", children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  return can(module, action) ? <>{children}</> : <>{fallback}</>;
}

export default PermissionGuard;
