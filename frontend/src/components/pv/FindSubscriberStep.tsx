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
 * The leader's first step: find an existing subscriber to renew, or, for a new one, whether they
 * are an ICF member (their membership record fills the details).
 */
function FindSubscriberStep({ visible, rootId, renew, onSubscriberChosen, onMemberFound, onContinue }: Props) {
  const { control } = useSubscriberForm();
  const isExisting = useWatch({ control, name: "isExisting" });

  return (
    <div className={visible ? "space-y-8" : "hidden"}>
      <ExistingSubscriberSection rootId={rootId} initial={renew} onChosen={onSubscriberChosen} />
      {isExisting === "N" && <IcfMemberSection onFound={onMemberFound} />}

      <Button type="button" onClick={onContinue} className="h-11 w-full rounded-full">
        Continue
        <ArrowRight />
      </Button>
    </div>
  );
}

export default FindSubscriberStep;
