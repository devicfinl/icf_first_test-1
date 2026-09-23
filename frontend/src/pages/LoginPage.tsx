import * as Form from "@radix-ui/react-form";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import { Text } from "@radix-ui/themes";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import AuthShell from "../components/AuthShell";
import { FormInput } from "../components/FormInput";
import SubmitButton from "../components/SubmitButton";
import PasswordEye from "../components/PasswordEye";
import { loginSchema, type LoginFormData } from "../utilities/validation";
import { loginUser } from "../thunks/authThunk";
import { clearError } from "../slices/authSlice";
import type { AppDispatch, RootState } from "../store/store";

function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, token, requiresPositionSelection } = useSelector(
    (state: RootState) => state.auth,
  );
  console.log("LoginPage: loading, error, token, requiresPositionSelection", loading, error, token, requiresPositionSelection);

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  // A stale message from a previous visit shouldn't greet the next one.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Already signed in (a refresh, or the back button after signing in).
  if (token) {
    return <Navigate to={requiresPositionSelection ? "/select-position" : "/"} replace />;
  }

  async function onSubmit(data: LoginFormData) {
    try {
      const result = await dispatch(loginUser(data)).unwrap();
      toast.success("Signed in");

      // Several cabinet positions means the session has no committee context yet, and the member
      // has to pick one before anything else loads.
      navigate(result.requires_position_selection ? "/select-position" : "/dashboard", { replace: true });
    } catch {
      // The rejected message is already in the store and rendered below.
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access the ICF International Portal"
    >
      <Form.Root onSubmit={handleSubmit(onSubmit)} className="w-full">
        <FormInput
          label="Membership number"
          placeholder="Enter your membership number"
          autoComplete="username"
          autoFocus
          error={errors.userName?.message}
          {...register("userName")}
        />

        <FormInput
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password?.message}
          rightSlot={<PasswordEye showPassword={showPassword} setShowPassword={setShowPassword} />}
          {...register("password")}
        />

        {error && (
          <Text as="p" size="2" className="text-red-600 mb-3">
            {error}
          </Text>
        )}

        <SubmitButton label={loading ? "Signing in..." : "Sign in"} disabled={loading} />
      </Form.Root>
    </AuthShell>
  );
}

export default LoginPage;
