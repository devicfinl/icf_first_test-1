import type { TargetPair } from "../../types/pv";

type Pair = Pick<TargetPair, "print" | "digital">;

type Props = {
  /** null until the level above sets it. */
  assigned: Pair | null;
  allocated: Pair;
};

const sum = (pair: Pair) => pair.print + pair.digital;

function Tile({ label, value, tone = "text-navy" }: { label: string; value: Pair | null; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#ecdfd1] px-4 py-3">
      <p className="text-[12px] text-[#6b6b6b]">{label}</p>
      {value ? (
        <>
          <p className={`mt-1 text-[20px] font-semibold ${tone}`}>{sum(value).toLocaleString()}</p>
          <p className="text-[12px] text-[#555]">
            Print <b className={tone}>{value.print.toLocaleString()}</b> · Digital{" "}
            <b className={tone}>{value.digital.toLocaleString()}</b>
          </p>
        </>
      ) : (
        <p className="mt-1 text-[20px] font-semibold text-[#999]">—</p>
      )}
    </div>
  );
}

/** Assigned, allocated and remaining, each split into print and digital. */
function TargetSummary({ assigned, allocated }: Props) {
  const remaining = assigned && { print: assigned.print - allocated.print, digital: assigned.digital - allocated.digital };
  const over = remaining !== null && (remaining.print < 0 || remaining.digital < 0);

  return (
    <section className="rounded-2xl bg-white px-5 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Assigned target" value={assigned} />
        <Tile label="Allocated so far" value={allocated} />
        <Tile label="Remaining" value={remaining} tone={over ? "text-red-600" : "text-navy"} />
      </div>
    </section>
  );
}

export default TargetSummary;
