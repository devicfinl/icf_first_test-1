import type { ChangeEvent } from "react";
import { useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

import FormSection from "../form/FormSection";
import TextField from "../form/TextField";
import YesNoSwitch from "./YesNoSwitch";
import { formatAmount, includesPrint } from "../../lib/pv";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import type { PriceState } from "../../hooks/useRegistrationPrice";
import { SELECTABLE_SUBSCRIPTION_MODES } from "../../types/pv";

type Props = {
  /** Currency and prices for the chosen unit; null while loading. */
  price: PriceState | null;
  /** Leader's form only; a public registration is saved with No. */
  showCashReceived: boolean;
  /** The final button's text; "Save And Continue" by default. */
  submitLabel?: string;
  submitError: string | null;
  isSubmitting: boolean;
};

/** Step 2: subscription mode, distribution and payment, then save. */
function SubscriptionStep({ price, showCashReceived, submitLabel = "Save And Continue", submitError, isSubmitting }: Props) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useSubscriberForm();

  const mode = useWatch({ control, name: "subscriptionMode" });
  const buildingName = useWatch({ control, name: "buildingName" });
  const province = useWatch({ control, name: "province" });
  const cashReceived = useWatch({ control, name: "cashReceived" });

  // These two repeat step-1 fields. The copies write through setValue, which also updates the
  // step-1 inputs, so both always show the same text.
  const syncField = (name: "buildingName" | "province") => (event: ChangeEvent<HTMLInputElement>) =>
    setValue(name, event.target.value, { shouldDirty: true, shouldValidate: true });

  const amount = mode && price?.value ? price.value.prices[mode] : null;

  return (
    <div className="space-y-8">
      <FormSection title="Subscriber Details">
        <Field data-invalid={errors.subscriptionMode ? true : undefined}>
          <FieldLabel htmlFor="subscriptionMode">
            Subscription Mode<span className="text-destructive">*</span>
          </FieldLabel>
          <NativeSelect
            id="subscriptionMode"
            className="w-full [&>select]:h-10"
            aria-invalid={errors.subscriptionMode ? true : undefined}
            {...register("subscriptionMode")}
          >
            <NativeSelectOption value="">Choose a mode</NativeSelectOption>
            {SELECTABLE_SUBSCRIPTION_MODES.map((option) => {
              const optionPrice = price?.value?.prices[option] ?? null;
              return (
                <NativeSelectOption key={option} value={option} disabled={Boolean(price?.value) && optionPrice === null}>
                  {optionPrice !== null && price?.value ? `${option} — ${formatAmount(optionPrice, price.value.currency)}` : option}
                </NativeSelectOption>
              );
            })}
          </NativeSelect>
          <FieldError>{errors.subscriptionMode?.message}</FieldError>
        </Field>

        <TextField
          id="buildingName2"
          label="Building Name"
          required
          error={errors.buildingName?.message}
          value={buildingName ?? ""}
          onChange={syncField("buildingName")}
        />
        <TextField
          id="province2"
          label="State/Province/Emirate"
          required
          error={errors.province?.message}
          value={province ?? ""}
          onChange={syncField("province")}
        />
        <TextField
          id="distributorArea"
          label="Distribution Lead"
          error={errors.distributorArea?.message}
          {...register("distributorArea")}
        />
        {includesPrint(mode) && (
          <TextField
            id="deliveryResponsibility"
            label="Delivery responsibility"
            error={errors.deliveryResponsibility?.message}
            {...register("deliveryResponsibility")}
          />
        )}
      </FormSection>

      <FormSection title="Payment Information">
        {price?.error ? (
          <Alert variant="destructive" className="rounded-xl md:col-span-2">
            <AlertDescription>{price.error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <TextField id="currency" label="Currency" value={price?.value?.currency ?? "Loading…"} readOnly disabled />
            <TextField
              id="amount"
              label="Amount"
              value={amount !== null && price?.value ? formatAmount(amount, price.value.currency) : "Choose a subscription mode"}
              readOnly
              disabled
            />
          </>
        )}

        {showCashReceived && (
        <Field className="md:col-span-2">
          <FieldLabel>Cash Received From Subscriber?</FieldLabel>
          <YesNoSwitch
            label="Cash Received From Subscriber"
            checked={cashReceived === "Y"}
            onChange={(on) => setValue("cashReceived", on ? "Y" : "N", { shouldDirty: true })}
          />
        </Field>
        )}
      </FormSection>

      {submitError && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || Boolean(price?.error) || !price?.value}
        className="h-11 w-full rounded-full"
      >
        {isSubmitting && <Spinner />}
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

export default SubscriptionStep;
