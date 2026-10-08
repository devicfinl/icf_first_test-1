import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "./useMediaQuery";

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Moves from the value last shown (0 the first time) to `target` over `duration` ms, for numbers
 * and bars that fill in. Shows the target straight away when the user prefers reduced motion.
 */
export function useAnimatedValue(target: number, duration = 900): number {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const from = shown.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min((now - start) / duration, 1);
      shown.current = from + (target - from) * easeOut(t);
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return reduced ? target : value;
}
