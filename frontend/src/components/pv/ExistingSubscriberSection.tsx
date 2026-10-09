import { useState, type KeyboardEvent } from "react";
import { useWatch } from "react-hook-form";
import { CircleCheck, Search } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import FormSection from "../form/FormSection";
import { apiErrorMessage } from "../../api/axios";
import { lookupSubscribers } from "../../api/pv";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import { EMPTY_SUBSCRIBER_FORM, formFromExisting, modeLabel } from "../../lib/pv";
import type { ExistingSubscriber, SubscriberLookup } from "../../types/pv";
import ConfirmDialog from "../ConfirmDialog";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

const addressLine = ({ previous }: ExistingSubscriber) =>
  [previous.shop_name, previous.building_name, previous.street, previous.area, previous.province]
    .filter(Boolean)
    .join(", ");

/**
 * Subscriber Information: "Is Existing Subscriber". Yes shows a search by subscriber number or
 * mobile number; choosing a result fills the form from their previous subscription (every field
 * stays editable) and the save becomes a renewal.
 */
type Props = {
  /** A subscriber already chosen (renewing from the renew list): shown as selected. */
  initial?: ExistingSubscriber;
  /** After a result is chosen and the fields are filled, e.g. to set the organisation dropdowns. */
  onChosen: (subscriber: ExistingSubscriber) => void;
};

function ExistingSubscriberSection({ initial, onChosen }: Props) {
  const {
    control,
    setValue,
    getValues,
    reset,
    clearErrors,
    formState: { errors },
  } = useSubscriberForm();

  const isExisting = useWatch({ control, name: "isExisting" });
  const chosenId = useWatch({ control, name: "subscriberId" });

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SubscriberLookup | null>(initial ? { year: null, subscribers: [initial] } : null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Clears what a chosen subscriber filled in, keeping the organisation choice.
  function clearFilled() {
    reset({ ...EMPTY_SUBSCRIBER_FORM, unitId: getValues("unitId") }, { keepDirty: true });
  }

  // Switching to No after a subscriber filled the form waits for this confirmation.
  const [confirmClear, setConfirmClear] = useState(false);

  function chooseAnswer(answer: "Y" | "N") {
    if (answer === isExisting) return;
    if (answer === "N" && chosenId) {
      setConfirmClear(true);
      return;
    }
    applyAnswer(answer);
  }

  function applyAnswer(answer: "Y" | "N") {
    setValue("isExisting", answer, { shouldDirty: true });
    clearErrors("subscriberId");
    setResult(null);
    setSearchError(null);
  }

  async function search() {
    const q = query.trim();
    if (!q) {
      setSearchError("Please enter the subscriber number or mobile number.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setResult(await lookupSubscribers(q));
    } catch (error) {
      setResult(null);
      setSearchError(apiErrorMessage(error, "Could not search. Please try again."));
    } finally {
      setSearching(false);
    }
  }

  // Enter searches; it must not submit the surrounding form.
  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void search();
    }
  }

  function choose(subscriber: ExistingSubscriber) {
    for (const [name, value] of Object.entries(formFromExisting(subscriber))) {
      setValue(name as keyof typeof EMPTY_SUBSCRIBER_FORM, value as never, { shouldDirty: true, shouldValidate: true });
    }
    clearErrors("subscriberId");
    onChosen(subscriber);
  }

  const chosen = result?.subscribers.find((subscriber) => subscriber.subscriber_id === chosenId);

  return (
    <FormSection title="Subscriber Information">
      <Field className="md:col-span-2">
        <FieldLabel>Is Existing Subscriber ?</FieldLabel>
        <div className="flex gap-6" role="radiogroup" aria-label="Is Existing Subscriber">
          {(["Y", "N"] as const).map((answer) => (
            <label key={answer} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="isExisting"
                checked={isExisting === answer}
                onChange={() => chooseAnswer(answer)}
                className="size-4 accent-navy"
              />
              {answer === "Y" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </Field>

      {isExisting === "Y" && (
        <div className="space-y-4 md:col-span-2">
          <Field data-invalid={searchError || errors.subscriberId ? true : undefined}>
            <FieldLabel htmlFor="subscriberSearch">Subscriber Number or Mobile Number</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="subscriberSearch"
                value={query}
                inputMode="search"
                autoComplete="off"
                placeholder="e.g. 10452 or 91678230"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
                className="h-10 bg-white"
              />
              <Button type="button" onClick={() => void search()} disabled={searching} className="h-10 rounded-full px-5">
                {searching ? <Spinner /> : <Search />}
                Search
              </Button>
            </div>
            <FieldError>{searchError ?? errors.subscriberId?.message}</FieldError>
          </Field>

          {result && result.subscribers.length === 0 && (
            <Alert className="rounded-xl bg-white">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                No subscriber found.
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => chooseAnswer("N")}>
                  Add as new subscriber
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {result && result.subscribers.length > 0 && (
            <ul className="space-y-3">
              {result.subscribers.map((subscriber) => {
                const isChosen = subscriber.subscriber_id === chosenId;
                const blocked = subscriber.already_registered_this_year;
                return (
                  <li
                    key={subscriber.subscriber_id}
                    className={`flex gap-3 rounded-xl border bg-white p-4 ${isChosen ? "border-navy ring-2 ring-navy/20" : "border-[#e7e1da]"} ${blocked ? "opacity-60" : ""}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3ebe2] text-sm font-semibold text-navy">
                      {initials(subscriber.name)}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1 text-[13px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-navy">{subscriber.name}</p>
                        <span className="rounded-full bg-[#f3ebe2] px-2 py-0.5 text-[11px] text-[#555]">
                          {modeLabel(subscriber.previous.subscription_mode)} {subscriber.previous.year ?? ""}
                        </span>
                        {!blocked && (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-700">Renew</span>
                        )}
                      </div>
                      <p className="text-[#555]">
                        No. {subscriber.subscriber_id}
                        {subscriber.ledger_no ? ` · Ledger ${subscriber.ledger_no}` : ""}
                        {subscriber.mobile ? ` · +${subscriber.mobile_country ?? ""} ${subscriber.mobile}` : ""}
                      </p>
                      <p className="text-[#6b6b6b]">
                        {[subscriber.previous.unit.name, addressLine(subscriber)].filter(Boolean).join(" — ")}
                      </p>
                      {blocked && (
                        <p className="font-medium text-red-600">Already registered for {result.year}.</p>
                      )}
                    </div>
                    {!blocked && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isChosen ? "default" : "outline"}
                        onClick={() => choose(subscriber)}
                        className="self-center rounded-full"
                      >
                        {isChosen ? <CircleCheck /> : null}
                        {isChosen ? "Selected" : "Select"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {chosen && (
            <p className="text-[13px] text-green-700">
              Filled from the {chosen.previous.year ?? "previous"} subscription. You can change any field.
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmClear}
        title="Clear the filled details?"
        description="The details filled from the existing subscriber will be cleared, so you can enter a new subscriber."
        confirmLabel="Clear"
        destructive
        onConfirm={() => {
          setConfirmClear(false);
          clearFilled();
          applyAnswer("N");
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </FormSection>
  );
}

export default ExistingSubscriberSection;
