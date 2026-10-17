import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { formatAmount } from "../../lib/pv";
import type { CreatedRegistration } from "../../types/pv";

type Props = {
  created: CreatedRegistration;
  onAddAnother: () => void;
  /** Without it there is no Close button (the public page). */
  onDone?: () => void;
};

/** Shown after a subscriber is saved, or after a public registration is received. */
function RegistrationSuccess({ created, onAddAnother, onDone }: Props) {
  const pending = created.approval_status === "PENDING";
  const title = pending
    ? "Registration received"
    : created.registration_type === "RENEW"
      ? "Subscription renewed"
      : "Subscriber added";

  return (
    <Card className="items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-none ring-0">
      <CircleCheck className="size-12 text-green-600" />
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">
        Subscription {created.subscription_year} · {formatAmount(created.amount, created.currency)}
      </p>
      {pending && (
        <p className="max-w-sm text-sm text-muted-foreground">
          Thank you. Your subscription will be confirmed once the committee approves it.
        </p>
      )}
      <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button onClick={onAddAnother} className="h-11 rounded-full px-6">
          {pending ? "Register another subscriber" : "Add another subscriber"}
        </Button>
        {onDone && (
          <Button variant="outline" onClick={onDone} className="h-11 rounded-full px-6">
            Close
          </Button>
        )}
      </div>
    </Card>
  );
}

export default RegistrationSuccess;
