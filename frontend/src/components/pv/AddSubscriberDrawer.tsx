import { useCallback, useRef, useState } from "react";

import AddSubscriberForm from "./AddSubscriberForm";
import ConfirmDialog from "../ConfirmDialog";
import FormPanel from "../layout/FormPanel";
import type {
  CreatedRegistration,
  ExistingSubscriber,
  SubscriberView,
} from "../../types/pv";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (created: CreatedRegistration) => void;
  /** Opens the form filled to renew this subscriber. */
  renew?: ExistingSubscriber;
  /** Opens the form filled to edit this subscriber's subscription. */
  editing?: SubscriberView;
  onEdited?: () => void;
};

/**
 * The new subscriber form: from the right on tablet and desktop, from the bottom on phones. The
 * form is mounted only while open, so each opening starts empty. Closing with unsaved entries asks first.
 */
function AddSubscriberDrawer({
  open,
  onOpenChange,
  onSaved,
  renew,
  editing,
  onEdited,
}: Props) {
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next && dirty.current) {
      // Unsaved entries: ask first, in the alert dialog.
      setConfirmDiscard(true);
      return;
    }
    if (!next) dirty.current = false;
    onOpenChange(next);
  }

  function discard() {
    setConfirmDiscard(false);
    dirty.current = false;
    onOpenChange(false);
  }

  return (
    <>
      <FormPanel
        open={open}
        onOpenChange={handleOpenChange}
        title={
          editing
            ? "Edit subscription"
            : renew
              ? "Renew subscription"
              : "New subscriber"
        }
        widthClass="sm:max-w-2xl data-[side=right]:sm:max-w-2xl"
      >
        {open && (
          <AddSubscriberForm
            renew={renew}
            editing={editing}
            onEdited={() => {
              // Saved: close without asking about unsaved changes.
              dirty.current = false;
              onOpenChange(false);
              onEdited?.();
            }}
            title={
              editing
                ? "Edit Subscription"
                : renew
                  ? "Renew Subscription"
                  : "New Subscriber"
            }
            onSaved={onSaved}
            onClose={() => handleOpenChange(false)}
            onDirtyChange={setDirty}
          />
        )}
      </FormPanel>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        description="The details you have entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

export default AddSubscriberDrawer;
