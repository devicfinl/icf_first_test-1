import * as Form from "@radix-ui/react-form";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import LegalPage, { LegalContact, LegalList, LegalSection, SUPPORT_EMAIL } from "../components/LegalPage";
import { FormInput } from "../components/FormInput";
import SubmitButton from "../components/SubmitButton";
import { cancelAccount } from "../thunks/authThunk";
import { clearError } from "../slices/authSlice";
import { cancelAccountSchema, type CancelAccountFormData } from "../utilities/validation";
import type { AppDispatch, RootState } from "../store/store";

/**
 * Public, so it can be linked from app store listings. ICF FIRST is an organisation's portal, so
 * an account is cancelled rather than deleted: sign-in stops, the records stay.
 */
function DeleteAccountPage() {
  const token = useSelector((state: RootState) => state.auth.token);

  return (
    <LegalPage title="Account Deletion" updated="1 October 2026">
      <LegalSection title="Cancelling your ICF FIRST account">
        <p>
          ICF FIRST is the member portal of ICF International. When you ask for your account to be deleted, we{" "}
          <span className="font-semibold">cancel</span> it: you can no longer sign in to the ICF FIRST app or
          website. Your records are not erased, because the organisation must keep them.
        </p>
      </LegalSection>

      <LegalSection title="What happens when you cancel">
        <LegalList
          items={[
            ["Stops", "Signing in to the ICF FIRST app and website. You are signed out straight away."],
            ["Kept", "Your membership record, committee history, donations and subscription records. ICF International keeps these for its organisational, financial and legal records."],
            ["Not shared", "Cancelling does not change how your information is protected. See our Privacy Policy."],
          ]}
        />
        <p>
          If you change your mind, contact us and we can restore your access. To ask for your personal data to
          be erased where the law allows, contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection title="How to cancel">
        {token ? (
          <CancelAccountForm />
        ) : (
          <div className="space-y-3">
            <p>Sign in first, then come back to this page to cancel your account.</p>
            <Link
              to="/login"
              state={{ from: "/deleteAccount" }}
              className="inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-deep"
            >
              Sign in to cancel
            </Link>
            <p className="text-sm text-muted-foreground">
              Can't sign in? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 underline-offset-2 hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address on your membership record, with your membership number, and we will cancel it for
              you.
            </p>
          </div>
        )}
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact />
      </LegalSection>
    </LegalPage>
  );
}

function CancelAccountForm() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelAccountFormData>({ resolver: zodResolver(cancelAccountSchema) });

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  async function onSubmit(data: CancelAccountFormData) {
    try {
      await dispatch(cancelAccount(data)).unwrap();
      toast.success("Your account has been cancelled");
      navigate("/login", { replace: true });
    } catch {
      // The rejected message is already in the store and rendered below.
    }
  }

  return (
    <Form.Root onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <FormInput
        label="Current password"
        type="password"
        placeholder="Enter your current password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <label className="mb-1 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" {...register("confirm")} />
        <span>
          I understand that I will no longer be able to sign in, and that my membership, donation and
          subscription records will be kept by ICF International.
        </span>
      </label>
      {errors.confirm && <p className="mb-3 text-sm text-red-500">{errors.confirm.message}</p>}

      {error && <p className="my-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <SubmitButton label={loading ? "Cancelling..." : "Cancel my account"} disabled={loading} />
      </div>
    </Form.Root>
  );
}

export default DeleteAccountPage;
