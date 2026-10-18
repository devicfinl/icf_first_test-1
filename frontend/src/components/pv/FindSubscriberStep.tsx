import { useWatch } from "react-hook-form";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import ExistingSubscriberSection from "./ExistingSubscriberSection";
import IcfMemberSection from "./IcfMemberSection";
import { useSubscriberForm } from "../../hooks/useSubscriberForm";
import type { ExistingSubscriber, IcfMember } from "../../types/pv";

type Props = {
  /** Kept mounted while hidden, so going back keeps the search. */
  visible: boolean;
  /** The leader's own place: searches and dropdowns stay below it. */
  rootId: number;
  /** Renewing this subscriber, chosen before the form opened. */
  renew?: ExistingSubscriber;
  onSubscriberChosen: (subscriber: ExistingSubscriber) => void;
  onMemberFound: (member: IcfMember) => void;
  onContinue: () => void;
};

/**
 * The leader's first step: is this an existing subscriber (then choose them), and, either way,
 * whether they are an ICF member. For a new subscriber, the membership record fills the details.
 */
function FindSubscriberStep({ visible, rootId, renew, onSubscriberChosen, onMemberFound, onContinue }: Props) {
  const { control } = useSubscriberForm();
  const isExisting = useWatch({ control, name: "isExisting" });
  const subscriberId = useWatch({ control, name: "subscriberId" });

  return (
    <div className={visible ? "space-y-8" : "hidden"}>
      <ExistingSubscriberSection rootId={rootId} initial={renew} onChosen={onSubscriberChosen} />
      {/* Asked once the first question is answered: for a renewal, after the subscriber is chosen. */}
      {(isExisting === "N" || (isExisting === "Y" && subscriberId)) && (
        <IcfMemberSection renewing={isExisting === "Y"} onFound={onMemberFound} />
      )}

      <Button type="button" onClick={onContinue} className="h-11 w-full rounded-full">
        Continue
        <ArrowRight />
      </Button>
    </div>
  );
}

export default FindSubscriberStep;
