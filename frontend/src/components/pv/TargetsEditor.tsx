import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Loader from "../loading-ui/Loader";
import TargetSummary from "./TargetSummary";
import TargetsTable, { type TargetEdit } from "./TargetsTable";
import { apiErrorMessage } from "../../api/axios";
import { fetchPvTargets, savePvTargets } from "../../api/pv";
import { useUnsavedChangesWarning } from "../../hooks/useUnsavedChangesWarning";
import type { PvTargets } from "../../types/pv";

const asText = (value: number | undefined) => (value === undefined ? "" : String(value));
const toNumber = (value: string) => (value.trim() === "" ? 0 : Number(value));
const isCount = (value: string) => value.trim() === "" || /^\d+$/.test(value.trim());

// The form's starting values: each place's saved target, blank where none is set.
function editsFrom(data: PvTargets): Record<number, TargetEdit> {
  return Object.fromEntries(
    data.children.map((row) => [row.id, { print: asText(row.target?.print), digital: asText(row.target?.digital) }]),
  );
}

// `total` split as evenly as whole numbers allow; the first places take the remainder.
const evenly = (total: number, count: number, index: number) =>
  Math.floor(total / count) + (index < total % count ? 1 : 0);

type Props = {
  /** Opens a place's own allocation, view-only. */
  onOpen: (id: number) => void;
  /** Whether there are unsaved changes, so closing can ask first. */
  onDirtyChange: (dirty: boolean) => void;
};

/**
 * Set Target: the leader's own print and digital target, shared out among the places directly
 * below. Each row opens that place's own allocation, view-only.
 */
function TargetsEditor({ onOpen, onDirtyChange }: Props) {
  const [data, setData] = useState<PvTargets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, TargetEdit>>({});
  // International only: its own target.
  const [own, setOwn] = useState<TargetEdit>({ print: "", digital: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchPvTargets()
      .then((loaded) => {
        setData(loaded);
        setEdits(editsFrom(loaded));
        setOwn({ print: asText(loaded.own?.print), digital: asText(loaded.own?.digital) });
        setError(null);
      })
      .catch((failure) => setError(apiErrorMessage(failure, "Could not load the targets.")));
  }, []);
  useEffect(load, [load]);

  const editable = Boolean(data?.can_allocate || data?.can_edit_own);
  const changed = useMemo(() => {
    if (!data) return [];
    return data.children.filter((row) => {
      const edit = edits[row.id];
      if (!edit || (edit.print.trim() === "" && edit.digital.trim() === "" && !row.target)) return false;
      return toNumber(edit.print) !== (row.target?.print ?? -1) || toNumber(edit.digital) !== (row.target?.digital ?? -1);
    });
  }, [data, edits]);
  const ownChanged =
    Boolean(data?.can_edit_own) &&
    (own.print.trim() !== "" || own.digital.trim() !== "") &&
    (toNumber(own.print) !== (data?.own?.print ?? -1) || toNumber(own.digital) !== (data?.own?.digital ?? -1));
  const dirty = changed.length > 0 || ownChanged;
  useUnsavedChangesWarning(dirty);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  if (!data) {
    return error ? (
      <Alert variant="destructive" className="rounded-xl">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <Loader label="Loading targets…" className="min-h-[330px] rounded-2xl bg-white" />
    );
  }

  // Live: the totals as they will be once saved.
  const assigned = data.can_edit_own ? { print: toNumber(own.print), digital: toNumber(own.digital) } : data.own;
  const allocated = data.children.reduce(
    (sum, row) => {
      const edit = data.can_allocate ? edits[row.id] : undefined;
      return {
        print: sum.print + (edit ? toNumber(edit.print) : (row.target?.print ?? 0)),
        digital: sum.digital + (edit ? toNumber(edit.digital) : (row.target?.digital ?? 0)),
      };
    },
    { print: 0, digital: 0 },
  );
  const invalid = [...Object.values(edits), own].some((edit) => !isCount(edit.print) || !isCount(edit.digital));
  const over = assigned !== null && (allocated.print > assigned.print || allocated.digital > assigned.digital);
  const nothingToSave = changed.length === 0 && !ownChanged;
  // A saved target cannot go back to draft, so the draft button only covers new ones.
  const draftable = !changed.some((row) => row.status === "Set" || row.status === "Over-allocated");

  async function save(status: "Active" | "Draft") {
    if (!data) return;
    setSaving(true);
    try {
      await savePvTargets({
        status,
        own: ownChanged ? { print: toNumber(own.print), digital: toNumber(own.digital) } : undefined,
        children: changed.map((row) => ({
          org_id: row.id,
          print: toNumber(edits[row.id]!.print),
          digital: toNumber(edits[row.id]!.digital),
        })),
      });
      toast.success(status === "Draft" ? "Targets saved as draft" : "Targets saved");
      load();
    } catch (failure) {
      toast.error(apiErrorMessage(failure, "Could not save the targets."));
    } finally {
      setSaving(false);
    }
  }

  function distributeEqually() {
    if (!data || !assigned) return;
    const count = data.children.length;
    setEdits(
      Object.fromEntries(
        data.children.map((row, index) => [
          row.id,
          { print: String(evenly(assigned.print, count, index)), digital: String(evenly(assigned.digital, count, index)) },
        ]),
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[20px] font-semibold text-navy">Set Target</h2>
        <p className="text-[13px] text-[#6b6b6b]">
          {data.place.name ?? "Pravasi Vayana"}
          {data.year ? ` · Pravasi Vayana ${data.year}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.can_allocate && (
          <>
            <Button variant="outline" onClick={distributeEqually} disabled={saving || !assigned}>
              Distribute equally
            </Button>
            <Button variant="outline" onClick={() => setEdits(editsFrom(data))} disabled={saving || changed.length === 0}>
              Reset
            </Button>
          </>
        )}
        {editable && (
          <>
            <Button
              variant="outline"
              onClick={() => save("Draft")}
              disabled={saving || nothingToSave || invalid || over || !draftable}
              title={draftable ? undefined : "Saved targets cannot go back to draft"}
            >
              Save as draft
            </Button>
            <Button onClick={() => save("Active")} disabled={saving || nothingToSave || invalid || over}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </div>

      {data.blocked_reason && (
        <Alert className="rounded-xl">
          <AlertDescription>{data.blocked_reason}</AlertDescription>
        </Alert>
      )}
      {data.own?.status === "Draft" && data.can_edit_own && (
        <Alert className="rounded-xl">
          <AlertDescription>Your targets are a draft: the countries cannot see them until you save.</AlertDescription>
        </Alert>
      )}
      {over && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>
            The targets below add up to more than your own {allocated.print > (assigned?.print ?? 0) ? "print" : "digital"}{" "}
            target. Lower them to save.
          </AlertDescription>
        </Alert>
      )}
      {invalid && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>Targets must be whole numbers, 0 or more.</AlertDescription>
        </Alert>
      )}

      {data.can_edit_own && (
        <section className="flex flex-wrap items-end gap-4 rounded-2xl bg-white px-5 py-4">
          <p className="w-full text-[15px] font-semibold text-navy">Overall International target</p>
          {(["print", "digital"] as const).map((channel) => (
            <label key={channel} className="text-[13px] text-[#555]">
              {channel === "print" ? "Print" : "Digital"}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={own[channel]}
                onChange={(event) => setOwn((value) => ({ ...value, [channel]: event.target.value }))}
                className="mt-1 block h-10 w-36 rounded-lg border border-[#e2d6c8] px-3 text-[15px] outline-none focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30"
              />
            </label>
          ))}
        </section>
      )}

      <TargetSummary assigned={assigned} allocated={allocated} />

      <TargetsTable
        rows={data.children}
        edits={data.can_allocate ? edits : undefined}
        onEdit={(id, edit) => setEdits((current) => ({ ...current, [id]: edit }))}
        onOpen={(row) => onOpen(row.id)}
      />
    </div>
  );
}

export default TargetsEditor;
