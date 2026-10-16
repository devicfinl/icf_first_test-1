import * as Form from "@radix-ui/react-form";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Text } from "@radix-ui/themes";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { FormInput } from "../FormInput";
import SubmitButton from "../SubmitButton";
import PasswordEye from "../PasswordEye";
import PasswordStrength from "../PasswordStrength";
import { CHANGE_PASSWORD_DRAWER, DRAWER_PARAM } from "../../lib/drawers";
import { changePasswordSchema, type ChangePasswordFormData } from "../../utilities/validation";
import { useAppContext } from "../../context/AppContext";

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { loading, error, changePassword } = useAppContext();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) });

  // useWatch rather than watch(): it subscribes without returning a fresh function each render,
  // which is what the React Compiler needs in order to memoize this component.
  const newPassword = useWatch({ control, name: "newPassword" });

  async function onSubmit(data: ChangePasswordFormData) {
    try {
      // The server swaps our token for a new one here, which the context stores; the session
      // survives the change on this device while the old token stops working everywhere else.
      await changePassword(data);
      toast.success("Password updated");
      onDone();
    } catch {
      // The rejected message is already in context state and rendered below.
    }
  }

  return (
    <Form.Root onSubmit={handleSubmit(onSubmit)} className="w-full">
      <FormInput
        label="Current password"
        type="password"
        placeholder="Enter your current password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <FormInput
        label="New password"
        type={showPassword ? "text" : "password"}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        rightSlot={<PasswordEye showPassword={showPassword} setShowPassword={setShowPassword} />}
        {...register("newPassword")}
      />
      <PasswordStrength password={newPassword ?? ""} />

      <FormInput
        label="Confirm new password"
        type={showPassword ? "text" : "password"}
        placeholder="Re-enter your new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      {error && (
        <Text as="p" size="2" className="mb-3 text-red-600">
          {error}
        </Text>
      )}

      <div className="my-4">
        <SubmitButton label={loading ? "Updating..." : "Update password"} disabled={loading} loading={loading} />
      </div>
    </Form.Root>
  );
}

/**
 * Change password, in a drawer from the right over whatever page is open. Opened by
 * ?drawer=change-password; closing removes it. The form is mounted only while open, so it starts
 * empty each time.
 */
function ChangePasswordDrawer() {
  const [params, setParams] = useSearchParams();
  const open = params.get(DRAWER_PARAM) === CHANGE_PASSWORD_DRAWER;

  function close() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(DRAWER_PARAM);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-cream p-5 sm:max-w-md sm:p-8">
        <SheetHeader className="px-0 pt-0">
          <SheetTitle className="font-heading text-2xl font-bold text-foreground">Change password</SheetTitle>
          <SheetDescription>Enter your current password, then choose a new one.</SheetDescription>
        </SheetHeader>
        {open && <ChangePasswordForm onDone={close} />}
      </SheetContent>
    </Sheet>
  );
}

export default ChangePasswordDrawer;
