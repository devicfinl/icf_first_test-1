import { cn } from "@/lib/utils";

import { Ripple } from "./ripple";

type Props = {
  label?: string;
  /** "block": centred in its own area (a card or section loading). "inline": next to text. */
  variant?: "block" | "inline";
  className?: string;
};

/** The app's loading state: the Ripple with a short message. */
function Loader({ label = "Loading…", variant = "block", className }: Props) {
  if (variant === "inline") {
    return (
      <span role="status" className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
        <Ripple className="size-5 text-clay" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
      <Ripple className="size-12 text-clay" aria-hidden />
      {label}
    </div>
  );
}

export default Loader;
