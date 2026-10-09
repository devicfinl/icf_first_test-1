import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import FormSection from "../form/FormSection";
import TextField from "../form/TextField";
import ExistingSubscriberSection from "./ExistingSubscriberSection";
import OrganisationFields from "./OrganisationFields";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import type { OrgLevel } from "../../hooks/useOrganisationLevels";
import type { ExistingSubscriber, OrgPlace } from "../../types/pv";

type Props = {
  /** Kept mounted while hidden, so step 2 can go back without losing anything. */
  visible: boolean;
  /** The leader's form has "Is Existing Subscriber"; the public form does not. */
  showExistingSearch: boolean;
  /** Renewing this subscriber, chosen before the form opened. */
  renew?: ExistingSubscriber;
  onSubscriberChosen: (subscriber: ExistingSubscriber) => void;
  path: OrgPlace[];
  levels: OrgLevel[];
  onChoosePlace: (index: number, placeId: number | null) => void;
  onContinue: () => void;
};

/** Step 1: organisation, existing-subscriber search, personal, address and contact details. */
function SubscriberDetailsStep({
  visible,
  showExistingSearch,
  renew,
  onSubscriberChosen,
  path,
  levels,
  onChoosePlace,
  onContinue,
}: Props) {
  const {
    register,
    formState: { errors },
  } = useSubscriberForm();

  return (
    <div className={visible ? "space-y-8" : "hidden"}>
      <OrganisationFields path={path} levels={levels} onChoose={onChoosePlace} error={errors.unitId?.message} />

      {showExistingSearch && <ExistingSubscriberSection initial={renew} onChosen={onSubscriberChosen} />}

      <FormSection title="Personal Information">
        <TextField
          id="name"
          label="Full Name"
          required
          autoComplete="name"
          error={errors.name?.message}
          className="md:col-span-2"
          {...register("name")}
        />
      </FormSection>

      <FormSection title="Address Information">
        <TextField id="shopName" label="Flat/Villa/Shop Name" error={errors.shopName?.message} {...register("shopName")} />
        <TextField id="floorNo" label="Floor No." error={errors.floorNo?.message} {...register("floorNo")} />
        <TextField
          id="buildingName"
          label="Building Name"
          required
          error={errors.buildingName?.message}
          {...register("buildingName")}
        />
        <TextField id="street" label="Street" error={errors.street?.message} {...register("street")} />
        <TextField id="area" label="Area" error={errors.area?.message} {...register("area")} />
        <TextField
          id="province"
          label="State/Province/Emirate"
          required
          error={errors.province?.message}
          {...register("province")}
        />
      </FormSection>

      <FormSection title="Contact Information">
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <TextField
            id="mobileCountry"
            label="Code"
            required
            inputMode="tel"
            placeholder="968"
            error={errors.mobileCountry?.message}
            {...register("mobileCountry")}
          />
          <TextField
            id="mobile"
            label="Mobile"
            required
            inputMode="tel"
            autoComplete="tel-national"
            error={errors.mobile?.message}
            {...register("mobile")}
          />
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <TextField
            id="whatsappCountry"
            label="Code"
            inputMode="tel"
            placeholder="968"
            error={errors.whatsappCountry?.message}
            {...register("whatsappCountry")}
          />
          <TextField id="whatsapp" label="WhatsApp" inputMode="tel" error={errors.whatsapp?.message} {...register("whatsapp")} />
        </div>
        <TextField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          id="contactPersonName"
          label="Contact Person / Sponsor"
          error={errors.contactPersonName?.message}
          {...register("contactPersonName")}
        />
      </FormSection>

      <Button type="button" onClick={onContinue} className="h-11 w-full rounded-full">
        Save And Continue
        <ArrowRight />
      </Button>
    </div>
  );
}

export default SubscriberDetailsStep;
