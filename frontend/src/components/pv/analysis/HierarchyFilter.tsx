import { useEffect, useState } from "react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { fetchChildPlaces } from "../../../api/pv";
import { levelLabel } from "../../../lib/pv";
import type { OrgPlace } from "../../../types/pv";

type Props = {
  /** The leader's own place: the first dropdown lists the places directly below it. */
  rootId: number;
  /** The places chosen, from below the leader's place down (empty: all). */
  path: OrgPlace[];
  /** The deepest place chosen (undefined for all) and the places chosen down to it. */
  onChange: (orgId: number | undefined, path: OrgPlace[]) => void;
};

// "All Regions", or "All Chapters / Regions" where a country has both directly below it.
function allLabel(options: OrgPlace[]) {
  const levels = [...new Set(options.map((option) => levelLabel(option.level)))];
  return `All ${levels.map((level) => `${level}s`).join(" / ")}`;
}

/**
 * One dropdown per level below the leader's place, each starting at "All": choosing a National shows
 * its Chapters / Regions, then Divisions, then Units. Choosing "All" goes back up to the level above.
 */
function HierarchyFilter({ rootId, path, onChange }: Props) {
  // The places below each parent, loaded once each.
  const [children, setChildren] = useState<Record<number, OrgPlace[]>>({});

  // A dropdown for the root and each chosen place, except a chosen Unit.
  const parents = [rootId, ...path.filter((place) => place.level !== "Unit").map((place) => place.id)];
  const missing = parents.filter((id) => !(id in children));
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!missingKey) return;
    let current = true;
    for (const id of missingKey.split(",").map(Number)) {
      fetchChildPlaces(id)
        .then((places) => current && setChildren((loaded) => ({ ...loaded, [id]: places })))
        .catch(() => current && setChildren((loaded) => ({ ...loaded, [id]: [] })));
    }
    return () => {
      current = false;
    };
  }, [missingKey]);

  return (
    <div className="flex flex-wrap gap-3">
      {parents.map((parentId, index) => {
        const options = children[parentId];
        if (options && options.length === 0) return null;
        const selected = path[index];
        return (
          <NativeSelect
            key={parentId}
            aria-label={options ? allLabel(options) : "Loading places"}
            disabled={!options}
            value={selected?.id ?? ""}
            onChange={(event) => {
              const place = options?.find((option) => option.id === Number(event.target.value));
              const next = place ? [...path.slice(0, index), place] : path.slice(0, index);
              onChange(next.at(-1)?.id, next);
            }}
            className="[&_select]:h-10 [&_select]:min-w-44 [&_select]:rounded-lg [&_select]:bg-white"
          >
            <NativeSelectOption value="">{options ? allLabel(options) : "Loading…"}</NativeSelectOption>
            {options?.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.name ?? `#${option.id}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        );
      })}
    </div>
  );
}

export default HierarchyFilter;
