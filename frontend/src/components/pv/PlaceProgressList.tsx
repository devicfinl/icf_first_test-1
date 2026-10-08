import { ChevronRight } from "lucide-react";

import { CountUp, GrowBar, PercentUp, Reveal } from "./Animated";
import { levelLabel } from "../../lib/pv";
import type { OrgPlace, PvProgress } from "../../types/pv";

// Green for high progress, as in the design; amber in between; red when far behind.
const barColor = (progress: number | null) =>
  progress === null
    ? "bg-[#cfc6bc]"
    : progress >= 0.75
      ? "bg-green-600"
      : progress >= 0.5
        ? "bg-amber-500"
        : "bg-red-500";

type Props = {
  places: (OrgPlace & PvProgress)[];
  onOpen: (place: OrgPlace) => void;
};

/** One card per place directly below the report's place; clicking one opens its report. */
function PlaceProgressList({ places, onOpen }: Props) {
  if (places.length === 0) return null;
  const heading = `All ${levelLabel(places[0]?.level)}${places.length === 1 ? "" : "s"}`;

  return (
    <section className="rounded-2xl bg-white px-4 py-5 sm:px-6">
      <h2 className="px-1 text-[17px] font-semibold text-navy">
        {heading}{" "}
        <span className="text-[13px] font-normal text-[#6b6b6b]">
          ({places.length})
        </span>
      </h2>
      <ul className="mt-4 space-y-3">
        {places.map((place, index) => (
          <Reveal as="li" key={place.id} order={index + 1}>
            <button
              type="button"
              onClick={() => onOpen(place)}
              className="flex w-full items-center gap-4 rounded-xl border border-[#ecdfd1] px-4 py-3 text-left transition-colors hover:bg-[#faf7f3]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-semibold text-navy">{place.name ?? "—"}</p>
                  <p className="text-[12px] text-[#6b6b6b]">
                    {place.target.toLocaleString()} Target
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <GrowBar
                      share={place.progress ?? 0}
                      className={barColor(place.progress)}
                    />
                  </div>
                  <span className="w-16 text-right text-[13px] font-medium text-navy">
                    {place.progress === null ? (
                      "—"
                    ) : (
                      <PercentUp value={place.progress} />
                    )}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#555]">
                  <span>
                    New{" "}
                    <b className="text-navy">
                      <CountUp value={place.new} />
                    </b>
                  </span>
                  <span>
                    Renewed{" "}
                    <b className="text-navy">
                      {place.renewals}/{place.renewable}
                    </b>
                  </span>
                  <span>
                    Paid{" "}
                    <b className="text-navy">
                      <CountUp value={place.paid} />
                    </b>
                  </span>
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-[#999]" />
            </button>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export default PlaceProgressList;
