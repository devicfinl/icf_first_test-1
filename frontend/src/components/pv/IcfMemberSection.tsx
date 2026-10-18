import { useState } from "react";
import { useWatch } from "react-hook-form";
import { CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

import FormSection from "../form/FormSection";
import { apiErrorMessage } from "../../api/axios";
import { lookupMember, searchMembers } from "../../api/pv";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import type { IcfMember, MemberSearch } from "../../types/pv";
import SearchCombobox from "./SearchCombobox";
import YesNoRadio from "./YesNoRadio";

type Props = {
  /** Renewing an existing subscriber: the membership number is recorded, their details are kept. */
  renewing?: boolean;
  /** A member was found and their details filled in, e.g. to set the organisation dropdowns. */
  onFound: (member: IcfMember) => void;
};

/**
 * "Is ICF Member?", for a new or a renewing subscriber. Yes asks for the membership number; for a
 * new subscriber it fills the name, mobile, WhatsApp and unit from the membership record (every
 * field stays editable). A renewal keeps the details chosen from the existing subscriber.
 */
function IcfMemberSection({ renewing = false, onFound }: Props) {
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

  async function find(picked: string) {
    const no = picked.trim().toUpperCase();
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
      clearErrors("membershipId");
      if (renewing) return;
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

  return (
    <FormSection title="ICF Member">
      <Field className="md:col-span-2" data-invalid={errors.isIcfMember ? true : undefined}>
        <FieldLabel>
          Is ICF Member ?<span className="text-destructive">*</span>
        </FieldLabel>
        {/* Neither is chosen at first: the leader must answer Yes or No to continue. */}
        <YesNoRadio
          label="Is ICF Member"
          values={["Yes", "No"]}
          value={isIcfMember}
          onChange={answer}
          invalid={Boolean(errors.isIcfMember)}
        />
        <FieldError>{errors.isIcfMember?.message}</FieldError>
      </Field>

      {isIcfMember === "Yes" && (
        <div className="space-y-4 md:col-span-2">
          <Field data-invalid={searchError || errors.membershipId ? true : undefined}>
            <FieldLabel htmlFor="membershipSearch">Membership Number</FieldLabel>
            {/* Type 2 or more characters of the number or name; choosing one fills the form. */}
            <SearchCombobox<MemberSearch["members"][number]>
              id="membershipSearch"
              value={number}
              onValueChange={setNumber}
              placeholder="Type the membership number or name"
              canSearch={(q) => q.length >= 2}
              search={async (q) => {
                const found = await searchMembers(q);
                return { items: found.members, more: found.more };
              }}
              itemKey={(item) => item.membership_no}
              renderItem={(item) => (
                <>
                  <p className="font-medium text-navy">
                    {item.membership_no} <span className="font-normal text-[#333]">· {item.name}</span>
                    {!item.active && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Inactive</span>
                    )}
                  </p>
                  {item.unit && <p className="text-[12px] text-[#6b6b6b]">{item.unit}</p>}
                </>
              )}
              onPick={(item) => {
                setNumber(item.membership_no);
                void find(item.membership_no);
              }}
              // A full number typed and Enter pressed is looked up directly.
              onEnter={(q) => {
                if (!/^[A-Z]{2}\d{7}$/i.test(q)) return;
                setNumber(q.toUpperCase());
                void find(q);
              }}
              empty={(q) => `No ICF member in your area matches “${q}”.`}
              busy={searching}
              invalid={Boolean(searchError || errors.membershipId)}
            />
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
                {!renewing && <p className="text-green-700">Name, mobile and unit filled in. You can change any field.</p>}
              </div>
            </div>
          )}

          {!renewing && member?.existing_subscriber && (
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
