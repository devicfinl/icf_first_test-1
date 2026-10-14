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
import { lookupMember } from "../../api/pv";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import type { IcfMember } from "../../types/pv";

type Props = {
  /** A member was found and their details filled in, e.g. to set the organisation dropdowns. */
  onFound: (member: IcfMember) => void;
};

/**
 * For a new subscriber: "Is ICF Member?". Yes asks for the membership number and fills the
 * name, mobile, WhatsApp and unit from the membership record (every field stays editable).
 */
function IcfMemberSection({ onFound }: Props) {
  const {
    control,
    setValue,
    clearErrors,
    formState: { errors },
  } = useSubscriberForm();
  const isIcfMember = useWatch({ control, name: "isIcfMember" });
  const membershipId = useWatch({ control, name: "membershipId" });

  const [number, setNumber] = useState(membershipId ?? "");
  const [member, setMember] = useState<IcfMember | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  function answer(value: "Yes" | "No") {
    setValue("isIcfMember", value, { shouldDirty: true });
    clearErrors(["isIcfMember", "membershipId"]);
    if (value === "No") {
      setValue("membershipId", "", { shouldDirty: true });
      setMember(null);
      setSearchError(null);
    }
  }

  async function find() {
    const no = number.trim().toUpperCase();
    if (!/^[A-Z]{2}\d{7}$/.test(no)) {
      setSearchError("Please enter a valid membership number, e.g. OM0001234.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const found = await lookupMember(no);
      setMember(found);
      const fill = { shouldDirty: true, shouldValidate: true } as const;
      setValue("membershipId", found.membership_no, fill);
      setValue("name", found.name, fill);
      if (found.mobile) {
        setValue("mobileCountry", found.mobile_country ?? "", fill);
        setValue("mobile", found.mobile, fill);
      }
      if (found.whatsapp) {
        setValue("whatsappCountry", found.mobile_country ?? "", fill);
        setValue("whatsapp", found.whatsapp, fill);
      }
      clearErrors("membershipId");
      onFound(found);
    } catch (error) {
      setMember(null);
      setValue("membershipId", "", { shouldDirty: true });
      setSearchError(apiErrorMessage(error, "Could not find the member. Please try again."));
    } finally {
      setSearching(false);
    }
  }

  // Enter looks the member up; it must not submit the surrounding form.
  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void find();
    }
  }

  return (
    <FormSection title="ICF Member">
      <Field className="md:col-span-2" data-invalid={errors.isIcfMember ? true : undefined}>
        <FieldLabel>
          Is ICF Member ?<span className="text-destructive">*</span>
        </FieldLabel>
        <div className="flex gap-6" role="radiogroup" aria-label="Is ICF Member">
          {(["Yes", "No"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="isIcfMember"
                checked={isIcfMember === value}
                onChange={() => answer(value)}
                className="size-4 accent-navy"
              />
              {value}
            </label>
          ))}
        </div>
        <FieldError>{errors.isIcfMember?.message}</FieldError>
      </Field>

      {isIcfMember === "Yes" && (
        <div className="space-y-4 md:col-span-2">
          <Field data-invalid={searchError || errors.membershipId ? true : undefined}>
            <FieldLabel htmlFor="membershipSearch">Membership Number</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="membershipSearch"
                value={number}
                autoComplete="off"
                placeholder="e.g. OM0001234"
                onChange={(event) => setNumber(event.target.value.toUpperCase())}
                onKeyDown={onKey}
                className="h-10 bg-white uppercase"
              />
              <Button type="button" onClick={() => void find()} disabled={searching} className="h-10 rounded-full px-5">
                {searching ? <Spinner /> : <Search />}
                Get details
              </Button>
            </div>
            <FieldError>{searchError ?? errors.membershipId?.message}</FieldError>
          </Field>

          {member && (
            <div className="flex gap-3 rounded-xl border border-navy bg-white p-4 text-[13px] ring-2 ring-navy/20">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-navy" />
              <div className="space-y-1">
                <p className="font-semibold text-navy">
                  {member.name} <span className="font-normal text-[#555]">· {member.membership_no}</span>
                </p>
                <p className="text-[#555]">
                  {[member.unit?.name, member.mobile ? `+${member.mobile_country ?? ""} ${member.mobile}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {!member.active && <p className="text-amber-700">This membership is not active.</p>}
                <p className="text-green-700">Name, mobile and unit filled in. You can change any field.</p>
              </div>
            </div>
          )}

          {member?.existing_subscriber && (
            <Alert className="rounded-xl bg-white">
              <AlertDescription>
                {member.existing_subscriber.name} is already a subscriber (No. {member.existing_subscriber.subscriber_id}).
                Choose Yes for “Is Existing Subscriber” and search that number to renew them instead.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </FormSection>
  );
}

export default IcfMemberSection;
