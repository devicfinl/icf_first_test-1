import { GrowBar, PercentUp } from "./Animated";
import type { PvProgress } from "../../types/pv";

const ratio = (part: number, whole: number) =>
  whole > 0 ? part / whole : null;

function DetailBar({
  label,
  value,
  share,
  color,
}: {
  label: string;
  value: string;
  share: number | null;
  color: string;
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-[#333]">{label}</span>
        <span className="font-medium text-navy">
          {value}
          <span className="ml-2 text-[12px] font-normal text-[#6b6b6b]">
            {share === null ? "—" : <PercentUp value={share} />}
          </span>
        </span>
      </div>
      <div className="mt-1.5">
        <GrowBar share={share ?? 0} className={color} />
      </div>
    </li>
  );
}

/** Detailed Data: New (of target), Renewed X/Y (of last year's) and Payment Completed X/Y. */
function ProgressDetails({ progress }: { progress: PvProgress }) {
  return (
    <section className="rounded-2xl bg-white px-5 py-4">
      <h2 className="text-[15px] font-semibold text-navy">Detailed Data</h2>
      <ul className="mt-3 space-y-4">
        <DetailBar
          label="New"
          value={String(progress.new)}
          share={ratio(progress.new, progress.target)}
          color="bg-clay"
        />
        <DetailBar
          label="Renewed"
          value={`${progress.renewals}/${progress.renewable}`}
          share={ratio(progress.renewals, progress.renewable)}
          color="bg-[#d4b08c]"
        />
        <DetailBar
          label="Payment Completed"
          value={`${progress.paid}/${progress.subscriptions}`}
          share={ratio(progress.paid, progress.subscriptions)}
          color="bg-navy"
        />
      </ul>
    </section>
  );
}

export default ProgressDetails;
