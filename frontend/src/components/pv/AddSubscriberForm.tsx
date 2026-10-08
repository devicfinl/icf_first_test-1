import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Loader from "../loading-ui/Loader";

import RegistrationSuccess from "./RegistrationSuccess";
import SubscriberDetailsStep from "./SubscriberDetailsStep";
import SubscriptionStep from "./SubscriptionStep";
import { apiErrorMessage } from "../../api/axios";
import { createPublicRegistration, createRegistration, leaderFormApi, publicFormApi, updateSubscription } from "../../api/pv";
import { useOrganisationLevels } from "../../hooks/useOrganisationLevels";
import { useRegistrationPrice } from "../../hooks/useRegistrationPrice";
import { useUnsavedChangesWarning } from "../../hooks/useUnsavedChangesWarning";
import { EMPTY_SUBSCRIBER_FORM, formFromExisting, formFromView, toPublicRequest, toRegistrationRequest } from "../../lib/pv";
import type { ApiEnvelope } from "../../types/auth";
import type { CreatedRegistration, ExistingSubscriber, RegistrationContext, SubscriberView } from "../../types/pv";
import {
  ADD_SUBSCRIBER_STEP1_FIELDS,
  addSubscriberSchema,
  type AddSubscriberFormData,
  type AddSubscriberFormInput,
} from "../../utilities/validation";

type Props = {
  /**
   * "leader": a signed-in leader (existing-subscriber search, cash received). "public": opened
   * from a leader's public link (`rootId`), saved as pending until a leader approves it.
   */
  variant?: "leader" | "public";
  rootId?: number;
  /** Opens the form already filled to renew this subscriber (from the renew list). */
  renew?: ExistingSubscriber;
  /** Opens the form filled from this subscriber's view, to edit that year's subscription. */
  editing?: SubscriberView;
  /** After an edit is saved (the form shows no success screen for edits). */
  onEdited?: () => void;
  title?: string;
  /** Called after each subscriber is saved, so lists can refresh. */
  onSaved?: (created: CreatedRegistration) => void;
  /** Without it, the success screen has no Close button. */
  onClose?: () => void;
  /** Whether there are unsaved entries, so closing the drawer can ask first. */
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Pravasi Vayana: the subscription form, in two steps. Owns the form state (the context, which
 * step is showing, saving and the result); each step renders its own fields.
 */
function AddSubscriberForm({
  variant = "leader",
  rootId,
  renew,
  editing,
  onEdited,
  title = "New Subscriber",
  onSaved,
  onClose,
  onDirtyChange,
}: Props) {
  const topRef = useRef<HTMLDivElement>(null);
  const isPublic = variant === "public";
  const source = useMemo(() => (isPublic ? publicFormApi(rootId!) : leaderFormApi), [isPublic, rootId]);

  const [context, setContext] = useState<RegistrationContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRegistration | null>(null);

  const form = useForm<AddSubscriberFormInput, unknown, AddSubscriberFormData>({
    resolver: zodResolver(addSubscriberSchema),
    defaultValues: EMPTY_SUBSCRIBER_FORM,
  });
  const {
    handleSubmit,
    control,
    setValue,
    setError,
    trigger,
    reset,
    getValues,
    formState: { isDirty, isSubmitting },
  } = form;

  const unitId = useWatch({ control, name: "unitId" });
  const price = useRegistrationPrice(source.loadPrice, unitId);
  const { levels, loadLevel, choosePlace, selectPath } = useOrganisationLevels(source.loadChildren, (chosen) =>
    chosen
      ? setValue("unitId", chosen, { shouldDirty: true, shouldValidate: true })
      : setValue("unitId", undefined as unknown as number, { shouldDirty: true }),
  );

  const unsaved = isDirty && !created;
  useUnsavedChangesWarning(unsaved);
  useEffect(() => {
    onDirtyChange?.(unsaved);
  }, [unsaved, onDirtyChange]);

  useEffect(() => {
    source
      .loadContext()
      .then((loaded) => {
        setContext(loaded);
        if (renew) {
          reset({ ...EMPTY_SUBSCRIBER_FORM, ...formFromExisting(renew), isExisting: "Y" });
        }
        if (editing) {
          reset(formFromView(editing));
        }
        if (!loaded.choose_unit) {
          // A Unit leader's (or Unit link's) own unit is fixed.
          setValue("unitId", loaded.leader.id);
        } else if (editing && editing.subscription.form_path.length > 0) {
          void selectPath(loaded.leader.id, editing.subscription.form_path);
        } else if (renew && renew.previous.path.length > 0) {
          void selectPath(loaded.leader.id, renew.previous.path);
        } else {
          loadLevel(loaded.leader.id, 0);
        }
      })
      .catch((error) =>
        setContextError(
          apiErrorMessage(error, isPublic ? "This registration link is not valid." : "Could not load your position."),
        ),
      );
    // Runs once, when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An existing subscriber was chosen in the search: set the dropdowns to their last unit too.
  function onSubscriberChosen(subscriber: ExistingSubscriber) {
    if (context?.choose_unit && subscriber.previous.path.length > 0) {
      void selectPath(context.leader.id, subscriber.previous.path);
    }
  }

  const scrollToTop = () => topRef.current?.scrollIntoView({ block: "start" });

  async function continueToStep2() {
    const valid = await trigger([...ADD_SUBSCRIBER_STEP1_FIELDS]);
    // A renewal needs the subscriber chosen from the search results.
    if (getValues("isExisting") === "Y" && !getValues("subscriberId")) {
      setError("subscriberId", { message: "Please search and select the subscriber, or choose No." });
      return;
    }
    if (valid) {
      setStep(2);
      scrollToTop();
    }
  }

  async function onSubmit(data: AddSubscriberFormData) {
    setSubmitError(null);
    try {
      if (editing) {
        const { subscriberId: _subscriberId, ...body } = toRegistrationRequest(data);
        void _subscriberId;
        await updateSubscription(editing.subscriber.subscriber_id, editing.subscription.year!, body);
        toast.success("Subscription updated");
        onEdited?.();
        return;
      }
      const saved = isPublic
        ? await createPublicRegistration(toPublicRequest(data, rootId!))
        : await createRegistration(toRegistrationRequest(data));
      setCreated(saved);
      onSaved?.(saved);
      if (!isPublic) toast.success(saved.registration_type === "RENEW" ? "Subscription renewed" : "Subscriber added");
      scrollToTop();
    } catch (error) {
      // Field errors come back as "body.<field>"; show them next to the field, on the right step.
      const fieldErrors = (error as AxiosError<ApiEnvelope<unknown>>).response?.data?.errors ?? [];
      let backToStep1 = false;
      for (const { field, message } of fieldErrors) {
        const name = field.replace(/^body\./, "") as keyof AddSubscriberFormInput;
        if (name in EMPTY_SUBSCRIBER_FORM) {
          setError(name, { message });
          if ((ADD_SUBSCRIBER_STEP1_FIELDS as readonly string[]).includes(name)) backToStep1 = true;
        }
      }
      if (backToStep1) setStep(1);
      setSubmitError(apiErrorMessage(error, "Could not save the subscriber. Please try again."));
    }
  }

  function addAnother() {
    // Keep the organisation choice: the next subscriber is usually for the same unit.
    reset({ ...EMPTY_SUBSCRIBER_FORM, unitId });
    setCreated(null);
    setSubmitError(null);
    setStep(1);
  }

  const onStep2 = step === 2 && !created;

  return (
    <div ref={topRef} className="scroll-mt-6">
      <div className="mb-6 flex items-end justify-between gap-4 pr-10">
        <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>
        {!created && context && <p className="text-sm text-muted-foreground">Step {step} of 2</p>}
      </div>

      {onStep2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep(1)}
          className="group/button mb-3 -ml-2.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="transition-transform duration-200 group-hover/button:-translate-x-0.5 motion-reduce:transform-none" />
          Back
        </Button>
      )}

      {contextError && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{contextError}</AlertDescription>
        </Alert>
      )}

      {!context && !contextError && (
        <Loader label="Loading the form…" />
      )}

      {context && created && <RegistrationSuccess created={created} onAddAnother={addAnother} onDone={onClose} />}

      {context && !created && (
        <FormProvider {...form}>
          {/* White fields on the cream background; locked (disabled) fields keep their grey tint. */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-8 [&_input:not(:disabled):not([type=radio])]:bg-white [&_select:not(:disabled)]:bg-white"
          >
            <SubscriberDetailsStep
              visible={step === 1}
              showExistingSearch={!isPublic && !editing}
              renew={renew}
              onSubscriberChosen={onSubscriberChosen}
              path={context.path}
              levels={levels}
              onChoosePlace={choosePlace}
              onContinue={() => void continueToStep2()}
            />
            {step === 2 && (
              <SubscriptionStep
                price={price}
                showCashReceived={!isPublic}
                submitLabel={editing ? "Save changes" : undefined}
                submitError={submitError}
                isSubmitting={isSubmitting}
              />
            )}
          </form>
        </FormProvider>
      )}
    </div>
  );
}

export default AddSubscriberForm;
