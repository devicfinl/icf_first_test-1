import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import ConfirmDialog from "../ConfirmDialog";
import FormPanel from "../layout/FormPanel";
import Loader from "../loading-ui/Loader";
import TargetSummary from "./TargetSummary";
import TargetsEditor from "./TargetsEditor";
import TargetsTable from "./TargetsTable";
import { apiErrorMessage } from "../../api/axios";
import { fetchPvTargets } from "../../api/pv";
import { levelLabel } from "../../lib/pv";
import type { PvTargets } from "../../types/pv";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A place below the leader's, view-only: how it shared out its target. */
function TargetsView({ orgId, onBack, onOpen }: { orgId: number; onBack: () => void; onOpen: (id: number) => void }) {
  const [result, setResult] = useState<{ id: number; data?: PvTargets; error?: string } | null>(null);

  useEffect(() => {
    let current = true;
    fetchPvTargets(orgId)
      .then((data) => current && setResult({ id: orgId, data }))
      .catch((failure) => current && setResult({ id: orgId, error: apiErrorMessage(failure, "Could not load the targets.") }));
    return () => {
      current = false;
    };
  }, [orgId]);

  const shown = result?.id === orgId ? result : null;
  const data = shown?.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-8 place-items-center rounded-lg hover:bg-white"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h2 className="text-[20px] font-semibold text-navy">{data?.place.name ?? "Targets"}</h2>
          {data && (
            <p className="text-[13px] text-[#6b6b6b]">
              {levelLabel(data.place.level)} · view only{data.own?.status === "Draft" ? " · draft" : ""}
            </p>
          )}
        </div>
      </div>

      {shown?.error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{shown.error}</AlertDescription>
        </Alert>
      )}
      {!shown && <Loader label="Loading targets…" className="min-h-[240px] rounded-2xl bg-white" />}
      {data && (
        <>
          <TargetSummary assigned={data.own} allocated={data.allocated} />
          <TargetsTable rows={data.children} onOpen={(row) => onOpen(row.id)} />
        </>
      )}
    </div>
  );
}

/**
 * Set Target, from the Analytics page: the leader's own allocation to edit, and the places below
 * to open view-only. The editor stays mounted while a place is open, so its entries are kept.
 * Closing with unsaved entries asks first.
 */
function SetTargetDrawer({ open, onOpenChange }: Props) {
  // The places opened from the editor, the one shown last.
  const [stack, setStack] = useState<number[]>([]);
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function close() {
    dirty.current = false;
    setStack([]);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) return onOpenChange(true);
    if (dirty.current) setConfirmDiscard(true);
    else close();
  }

  const shownId = stack.at(-1);
  const push = (id: number) => setStack((ids) => [...ids, id]);

  return (
    <>
      <FormPanel
        open={open}
        onOpenChange={handleOpenChange}
        title="Set Target"
        widthClass="sm:max-w-5xl data-[side=right]:sm:max-w-5xl"
      >
        {open && (
          <>
            <div className={shownId === undefined ? undefined : "hidden"}>
              <TargetsEditor onOpen={push} onDirtyChange={setDirty} />
            </div>
            {shownId !== undefined && (
              <TargetsView
                key={shownId}
                orgId={shownId}
                onBack={() => setStack((ids) => ids.slice(0, -1))}
                onOpen={push}
              />
            )}
          </>
        )}
      </FormPanel>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        description="The targets you have entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          close();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

export default SetTargetDrawer;
