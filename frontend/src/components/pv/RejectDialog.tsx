import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

import FormPanel from "../layout/FormPanel";

type Props = {
  /** Who is being rejected; null keeps the dialog closed. */
  name: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

/** A drawer (bottom on phones) that asks for the reason before a public registration is rejected; the reason is required. */
function RejectDialog({ name, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormPanel
      open={name !== null}
      onOpenChange={(open) => !open && !saving && onCancel()}
      title="Reject registration"
      description={`Rejecting ${name}.`}
    >
      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Reject registration</h2>
          <p className="mt-1 text-sm text-muted-foreground">Rejecting {name}. The reason is shown in the Rejected list.</p>
        </div>
        <Textarea
          aria-label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Already a subscriber; renewed from the Renew list"
          maxLength={500}
          rows={4}
          className="bg-white"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={saving || !reason.trim()}>
            {saving && <Spinner />}
            Reject
          </Button>
        </div>
      </div>
    </FormPanel>
  );
}

export default RejectDialog;
