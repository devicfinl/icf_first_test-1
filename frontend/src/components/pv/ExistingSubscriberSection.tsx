import { useState } from "react";
import { useWatch } from "react-hook-form";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

import FormSection from "../form/FormSection";
import { lookupSubscribers } from "../../api/pv";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import { EMPTY_SUBSCRIBER_FORM, formFromExisting, modeLabel } from "../../lib/pv";
import type { ExistingSubscriber, OrgPlace } from "../../types/pv";
import ConfirmDialog from "../ConfirmDialog";
import YesNoRadio from "./YesNoRadio";
import SearchCombobox from "./SearchCombobox";
import HierarchyFilter from "./analysis/HierarchyFilter";

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

/** One subscriber in the dropdown (and the chosen one under it). */
function SubscriberOption({ subscriber, year }: { subscriber: ExistingSubscriber; year: number | null }) {
  const blocked = subscriber.already_registered_this_year;
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3ebe2] text-[12px] font-semibold text-navy">
        {initials(subscriber.name)}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-navy">{subscriber.name}</span>
          <span className="rounded-full bg-[#f3ebe2] px-2 py-0.5 text-[11px] text-[#555]">
            {modeLabel(subscriber.previous.subscription_mode)} {subscriber.previous.year ?? ""}
          </span>
        </p>
        <p className="text-[#555]">
          No. {subscriber.subscriber_id}
          {subscriber.ledger_no ? ` · Ledger ${subscriber.ledger_no}` : ""}
          {subscriber.mobile ? ` · +${subscriber.mobile_country ?? ""} ${subscriber.mobile}` : ""}
        </p>
        <p className="text-[#6b6b6b]">{[subscriber.previous.unit.name, addressLine(subscriber)].filter(Boolean).join(" — ")}</p>
        {blocked && <p className="font-medium text-red-600">Already registered{year ? ` for ${year}` : " this year"}.</p>}
      </div>
    </div>
  );
}

/**
 * "Is Existing Subscriber". Yes shows a search by name, mobile, address, ledger or subscriber
 * number, optionally within one place below the leader's (division, unit, ...); a place alone
 * lists its subscribers. Choosing a result fills the form from their previous subscription (every
 * field stays editable) and the save becomes a renewal.
 */
type Props = {
  /** The leader's own place: the place dropdowns start below it. */
  rootId: number;
  /** A subscriber already chosen (renewing from the renew list): shown as selected. */
  initial?: ExistingSubscriber;
  /** After a result is chosen and the fields are filled, e.g. to set the organisation dropdowns. */
  onChosen: (subscriber: ExistingSubscriber) => void;
};

function ExistingSubscriberSection({ rootId, initial, onChosen }: Props) {
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
  // The places chosen to search in, from below the leader's down (empty: the whole branch).
  const [placePath, setPlacePath] = useState<OrgPlace[]>([]);
  // The subscriber chosen from the dropdown, shown under it.
  const [chosen, setChosen] = useState<ExistingSubscriber | null>(initial ?? null);
  // The open campaign year, from the last search: "Already registered for 2026".
  const [year, setYear] = useState<number | null>(null);

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
    clearErrors(["isExisting", "subscriberId"]);
    setChosen(null);
    setQuery("");
  }

  const orgId = placePath.at(-1)?.id;
  // As the server accepts: a number of any length, 2 or more letters, or just a place.
  const canSearch = (q: string) => /^\d+$/.test(q) || q.length >= 2 || (q === "" && orgId !== undefined);

  async function search(q: string) {
    const found = await lookupSubscribers(q, orgId);
    setYear(found.year);
    return { items: found.subscribers, more: found.more };
  }

  function choose(subscriber: ExistingSubscriber) {
    for (const [name, value] of Object.entries(formFromExisting(subscriber))) {
      setValue(name as keyof typeof EMPTY_SUBSCRIBER_FORM, value as never, { shouldDirty: true, shouldValidate: true });
    }
    clearErrors("subscriberId");
    setChosen(subscriber);
    setQuery(subscriber.name);
    onChosen(subscriber);
  }

  const shownChosen = chosen && chosen.subscriber_id === chosenId ? chosen : null;

  return (
    <FormSection title="Subscriber Information">
      <Field className="md:col-span-2" data-invalid={errors.isExisting ? true : undefined}>
        <FieldLabel>
          Is Existing Subscriber ?<span className="text-destructive">*</span>
        </FieldLabel>
        {/* Neither is chosen at first: the leader must answer Yes or No to continue. */}
        <YesNoRadio
          label="Is Existing Subscriber"
          values={["Y", "N"]}
          value={isExisting}
          onChange={chooseAnswer}
          invalid={Boolean(errors.isExisting)}
        />
        <FieldError>{errors.isExisting?.message}</FieldError>
      </Field>

      {isExisting === "Y" && (
        <div className="space-y-4 md:col-span-2">
          {/* The places first, then the search box under them. */}
          <div className="space-y-2">
            <p className="text-[13px] text-[#555]">Search in (optional)</p>
            <HierarchyFilter rootId={rootId} path={placePath} onChange={(_id, path) => setPlacePath(path)} />
          </div>

          <Field data-invalid={errors.subscriberId ? true : undefined}>
            <FieldLabel htmlFor="subscriberSearch">Search subscriber</FieldLabel>
            <SearchCombobox<ExistingSubscriber>
              id="subscriberSearch"
              value={query}
              onValueChange={setQuery}
              placeholder="Name, mobile, address, PV ledger or subscriber no."
              canSearch={canSearch}
              search={search}
              scope={String(orgId ?? "")}
              itemKey={(subscriber) => String(subscriber.subscriber_id)}
              disabled={(subscriber) => subscriber.already_registered_this_year}
              renderItem={(subscriber) => <SubscriberOption subscriber={subscriber} year={year} />}
              onPick={choose}
              empty={() => (
                <span className="flex flex-wrap items-center justify-between gap-3">
                  No subscriber found.
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => chooseAnswer("N")}>
                    Add as new subscriber
                  </Button>
                </span>
              )}
              invalid={Boolean(errors.subscriberId)}
            />
            <FieldError>{errors.subscriberId?.message}</FieldError>
          </Field>

          {shownChosen && (
            <div className="flex gap-3 rounded-xl border border-navy bg-white p-4 ring-2 ring-navy/20">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-navy" />
              <div className="min-w-0 flex-1 space-y-1 text-[13px]">
                <SubscriberOption subscriber={shownChosen} year={year} />
                <p className="text-green-700">
                  Filled from the {shownChosen.previous.year ?? "previous"} subscription. You can change any field.
                </p>
              </div>
            </div>
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
