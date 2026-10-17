import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type ShareColumn<T> = {
  key: string;
  label: string;
  /** Plain text, as it goes in the message. */
  text: (row: T) => string;
  /** Ticked when the dialog opens; true unless false. */
  shown?: boolean;
};

/** One way to look at the table: its columns and its rows, in the order they are listed. */
export type ShareView<T> = {
  id: string;
  label: string;
  columns: ShareColumn<T>[];
  rows: T[];
  /** The total row, when the table has one. */
  total?: T;
  /** How the rows are ordered, for the heading, e.g. "by % of target". */
  order?: string;
};

type Props<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The message's first line, e.g. "Pravasi Vayana 2026 · Bousher". */
  title: string;
  /** The filters in words; shown under the title when Filters is ticked. */
  details: string[];
  /** What a row is, e.g. "Unit" or "Subscriber". */
  entity: string;
  name: (row: T) => string;
  views: ShareView<T>[];
  /** The view the dialog opens on; the first when not given. */
  initialView?: string;
  /** "Top" for ranked places, "First" for a plain list. */
  countWord?: "Top" | "First";
};

const COUNTS = [5, 10, 20] as const;
type Count = (typeof COUNTS)[number] | "all";

function Tick({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[14px] text-[#333]">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {children}
    </label>
  );
}

function Legend({ children }: { children: string }) {
  return <p className="mb-2 text-[11px] font-medium tracking-wider text-[#555] uppercase">{children}</p>;
}

/**
 * Share a table on WhatsApp: pick the view, what goes in the message, the columns and how many
 * rows, see the message, then copy it or open WhatsApp with it.
 */
function ShareTableDialog<T>({ open, onOpenChange, ...props }: Props<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white p-5 sm:max-w-xl">
        {/* Mounted only while open, so each opening starts from the defaults. */}
        {open && <ShareBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareBody<T>({ title, details, entity, name, views, initialView, countWord = "Top" }: Omit<Props<T>, "open" | "onOpenChange">) {
  const [viewId, setViewId] = useState(initialView ?? views[0]?.id ?? "");
  const view = views.find((item) => item.id === viewId) ?? views[0]!;
  // The ticked columns of each view, so going back to a view keeps its choice.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const chosen = picked[view.id] ?? view.columns.filter((column) => column.shown !== false).map((column) => column.key);
  const columns = view.columns.filter((column) => chosen.includes(column.key));
  const [withFilters, setWithFilters] = useState(true);
  const [withBreakdown, setWithBreakdown] = useState(true);
  const [withTotal, setWithTotal] = useState(true);
  const [count, setCount] = useState<Count>(10);

  const rows = count === "all" ? view.rows : view.rows.slice(0, count);
  const values = (row: T) => columns.map((column) => column.text(row)).join(" | ");

  const lines = [`*${title}*`];
  if (withFilters && details.length > 0) lines.push(`📅 ${details.join(" · ")}`);
  if (withBreakdown && columns.length > 0 && rows.length > 0) {
    const which = count === "all" || rows.length < count ? `All ${view.rows.length}` : `${countWord} ${count}`;
    lines.push("", `*🏆 ${entity} breakdown — ${view.label} (${[which, view.order].filter(Boolean).join(" · ")}):*`);
    lines.push(columns.map((column) => column.label).join(" | "));
    rows.forEach((row, index) => lines.push(`${index + 1}. ${name(row)}: ${values(row)}`));
  }
  if (withTotal && view.total && columns.length > 0) lines.push("", `*Total:* ${values(view.total)}`);
  const message = lines.join("\n");

  function toggleColumn(key: string, on: boolean) {
    const next = on ? view.columns.map((c) => c.key).filter((k) => k === key || chosen.includes(k)) : chosen.filter((k) => k !== key);
    setPicked((current) => ({ ...current, [view.id]: next }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copied. Paste it in WhatsApp or anywhere else.");
    } catch {
      toast.error("Could not copy. Select the message and copy it instead.");
    }
  }

  function share() {
    // wa.me opens WhatsApp (the app on a phone, WhatsApp Web on a computer) with the message ready.
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-[20px] font-semibold text-navy">Share on WhatsApp</DialogTitle>
        <DialogDescription>Choose what to share, check the message, then copy it or send it.</DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {views.length > 1 && (
          <label className="block">
            <Legend>Share view</Legend>
            <NativeSelect value={view.id} onChange={(event) => setViewId(event.target.value)} className="w-full">
              {views.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}

        <div>
          <Legend>Include in message</Legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Tick checked={withFilters} onChange={setWithFilters}>
              Filters
            </Tick>
            <Tick checked={withBreakdown} onChange={setWithBreakdown}>
              {`${entity} breakdown`}
            </Tick>
            {view.total && (
              <Tick checked={withTotal} onChange={setWithTotal}>
                Total
              </Tick>
            )}
          </div>
        </div>

        <div>
          <Legend>Columns to include</Legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {view.columns.map((column) => (
              <Tick key={column.key} checked={chosen.includes(column.key)} onChange={(on) => toggleColumn(column.key, on)}>
                {column.label}
              </Tick>
            ))}
          </div>
        </div>

        {withBreakdown && (
          <div>
            <Legend>{`${entity}s to include`}</Legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...COUNTS, "all" as const].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={count === option}
                  onClick={() => setCount(option)}
                  className={`rounded-lg border py-2 text-[14px] transition-colors ${
                    count === option ? "border-navy bg-navy text-white" : "border-[#e2d6c8] bg-white text-[#333] hover:bg-[#faf7f3]"
                  }`}
                >
                  {option === "all" ? `All (${view.rows.length})` : `${countWord} ${option}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Legend>Message preview</Legend>
          <pre className="max-h-64 overflow-auto rounded-xl border border-[#ecdfd1] bg-[#faf7f3] p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-[#333]">
            {message}
          </pre>
        </div>
      </div>

      <DialogFooter className="-mx-5 -mb-5 bg-[#faf7f3] p-4">
        <Button variant="outline" onClick={copy}>
          <Copy />
          Copy Text
        </Button>
        <Button onClick={share}>
          <Share2 />
          Share on WhatsApp
        </Button>
      </DialogFooter>
    </>
  );
}

export default ShareTableDialog;
