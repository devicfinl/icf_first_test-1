import * as Form from "@radix-ui/react-form";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import toast from "react-hot-toast";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormInput } from "../components/FormInput";
import SubmitButton from "../components/SubmitButton";
import PasswordEye from "../components/PasswordEye";
import PasswordStrength from "../components/PasswordStrength";
import { changePasswordSchema, type ChangePasswordFormData } from "../utilities/validation";
import { changePassword } from "../thunks/authThunk";
import type { AppDispatch, RootState } from "../store/store";

function ChangePassword() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);

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
      // The server swaps our token for a new one here, which the thunk stores; the session
      // survives the change on this device while the old token stops working everywhere else.
      await dispatch(changePassword(data)).unwrap();
      toast.success("Password updated");
      navigate("/dashboard", { replace: true });
    } catch {
      // The rejected message is already in the store and rendered below.
    }
  }

  return (
    <Flex align="center" justify="center" className="min-h-screen px-4">
      <Card size="5" className="w-full max-w-md shadow-lg">
        <Flex direction="column" gap="1" mb="4">
          <Heading size="5">Change password</Heading>
          <Text size="2" color="gray">
            Enter your current password, then choose a new one.
          </Text>
        </Flex>

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
            <Text as="p" size="2" className="text-red-600 mb-3">
              {error}
            </Text>
          )}

          <Flex gap="3" className="my-4">
            <SubmitButton label={loading ? "Updating..." : "Update password"} disabled={loading} />
          </Flex>

          <Text
            as="span"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/dashboard")}
            onKeyDown={(event) => event.key === "Enter" && navigate("/dashboard")}
            className="block text-center text-sm text-blue-600 cursor-pointer hover:text-blue-900 transition-colors"
          >
            Cancel
          </Text>
        </Form.Root>
      </Card>
    </Flex>
  );
}

export default ChangePassword;
