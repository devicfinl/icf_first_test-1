import { useEffect, useState } from "react";

import { apiErrorMessage } from "../api/axios";
import type { PvFormApi, RegistrationPrice } from "../types/pv";

export type PriceState = { value: RegistrationPrice | null; error: string | null };

/** Currency and prices for the chosen unit; null until they are loaded for that unit. */
export function useRegistrationPrice(loadPrice: PvFormApi["loadPrice"], unitId: number | undefined): PriceState | null {
  const [price, setPrice] = useState<(PriceState & { unitId: number }) | null>(null);

  useEffect(() => {
    if (!unitId) return;
    let current = true;
    loadPrice(unitId)
      .then((value) => current && setPrice({ unitId, value, error: null }))
      .catch(
        (error) =>
          current &&
          setPrice({ unitId, value: null, error: apiErrorMessage(error, "Could not load the subscription price.") }),
      );
    return () => {
      current = false;
    };
  }, [loadPrice, unitId]);

  // An answer for a unit that is no longer chosen does not count.
  return price && price.unitId === unitId ? price : null;
}
