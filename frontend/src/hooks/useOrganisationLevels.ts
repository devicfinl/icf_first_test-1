import { useState } from "react";
import { toast } from "sonner";

import { apiErrorMessage } from "../api/axios";
import type { OrgPlace, PvFormApi } from "../types/pv";

/** One organisation dropdown: the places under `parentId`, and which one is chosen. */
export type OrgLevel = { parentId: number; options: OrgPlace[]; selected: number | null; loading: boolean };

/**
 * The chain of organisation dropdowns below a leader's place: each choice loads the places under
 * it, until a Unit is chosen. `onUnitChange` hears the chosen unit, or undefined when none is.
 */
export function useOrganisationLevels(
  loadChildren: PvFormApi["loadChildren"],
  onUnitChange: (unitId: number | undefined) => void,
) {
  const [levels, setLevels] = useState<OrgLevel[]>([]);

  // Loads the places under `parentId` into dropdown number `index`, dropping any below it.
  function loadLevel(parentId: number, index: number) {
    setLevels((current) => [...current.slice(0, index), { parentId, options: [], selected: null, loading: true }]);

    loadChildren(parentId)
      .then((options) => {
        setLevels((current) =>
          // Ignore an answer for a dropdown that has since been replaced by another choice above it.
          current[index]?.parentId === parentId
            ? current.map((level, i) => (i === index ? { ...level, options, loading: false } : level))
            : current,
        );
      })
      .catch((error) => {
        setLevels((current) => current.slice(0, index));
        toast.error(apiErrorMessage(error, "Could not load the organisation list."));
      });
  }

  function choosePlace(index: number, placeId: number | null) {
    const place = levels[index]?.options.find((option) => option.id === placeId) ?? null;

    setLevels((current) =>
      current.slice(0, index + 1).map((level, i) => (i === index ? { ...level, selected: placeId } : level)),
    );

    if (place?.level === "Unit") {
      onUnitChange(place.id);
      return;
    }

    onUnitChange(undefined);
    if (place) loadLevel(place.id, index + 1);
  }

  /**
   * Sets every dropdown below `rootId` to `path` at once (an existing subscriber's division and
   * unit). Stops at a place that is not offered, leaving the rest to choose by hand.
   */
  async function selectPath(rootId: number, path: OrgPlace[]) {
    const chosen: OrgLevel[] = [];
    let parentId = rootId;
    try {
      for (const place of path) {
        const options = await loadChildren(parentId);
        if (!options.some((option) => option.id === place.id)) break;
        chosen.push({ parentId, options, selected: place.id, loading: false });
        parentId = place.id;
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load the organisation list."));
    }
    if (chosen.length === 0) return;

    const last = path[chosen.length - 1]!;
    setLevels(chosen);
    if (last.level === "Unit") {
      onUnitChange(last.id);
    } else {
      onUnitChange(undefined);
      loadLevel(last.id, chosen.length);
    }
  }

  return { levels, loadLevel, choosePlace, selectPath };
}
