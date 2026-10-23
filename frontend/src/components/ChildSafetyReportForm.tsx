import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import TextField from "./form/TextField";
import {
  CHILD_SAFETY_CONCERNS,
  childSafetyReportSchema,
  type ChildSafetyReportFormData,
} from "../utilities/validation";

/**
 * Public child safety report form.
 *
 * DUMMY: nothing is sent or stored yet. Submitting only validates and shows the confirmation.
 * Before relying on it, add an API endpoint (no auth, rate limited) that stores the report and
 * emails the child safety contact, and call it from onSubmit.
 */
function ChildSafetyReportForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChildSafetyReportFormData>({ resolver: zodResolver(childSafetyReportSchema) });

  function onSubmit() {
    // TODO: send the report to the API once the endpoint exists.
    reset();
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="space-y-3 rounded-xl bg-shell px-4 py-5 text-center">
        <CircleCheck className="mx-auto size-8 text-green-700" aria-hidden />
        <p className="font-semibold text-foreground">Thank you. Your report has been received.</p>
        <p className="text-sm">
          If you gave an email address, we will acknowledge your report within 24 hours. If a child is in
          immediate danger, call 112 now.
        </p>
        <Button type="button" variant="outline" onClick={() => setSent(false)}>
          Send another report
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 rounded-xl bg-shell px-4 py-5">
      <Field data-invalid={errors.concern ? true : undefined}>
        <FieldLabel htmlFor="cs-concern">
          What are you reporting?<span className="text-destructive">*</span>
        </FieldLabel>
        <NativeSelect
          id="cs-concern"
          defaultValue=""
          aria-invalid={errors.concern ? true : undefined}
          className="w-full"
          {...register("concern")}
        >
          <NativeSelectOption value="" disabled>
            Choose one
          </NativeSelectOption>
          {CHILD_SAFETY_CONCERNS.map((concern) => (
            <NativeSelectOption key={concern} value={concern}>
              {concern}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError>{errors.concern?.message}</FieldError>
      </Field>

      <Field data-invalid={errors.details ? true : undefined}>
        <FieldLabel htmlFor="cs-details">
          What happened?<span className="text-destructive">*</span>
        </FieldLabel>
        <Textarea
          id="cs-details"
          rows={5}
          placeholder="Describe what you saw and when. Do not attach, copy or send any abusive images."
          aria-invalid={errors.details ? true : undefined}
          {...register("details")}
        />
        <FieldError>{errors.details?.message}</FieldError>
      </Field>

      <TextField
        id="cs-where"
        label="Where did you see it? (optional)"
        placeholder="Membership number, page or link"
        error={errors.where?.message}
        {...register("where")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="cs-name"
          label="Your name (optional)"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          id="cs-email"
          label="Your email (optional)"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        You can report anonymously. Leave an email address if you want us to reply. Reports are kept
        confidential.
      </p>

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        Send report
      </Button>
    </form>
  );
}

export default ChildSafetyReportForm;
