import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  /** Read out by screen readers; not shown. */
  label?: string;
  /**
   * "block": fills its own area (a card or section loading). "rows": table rows, for a table
   * with nothing to show yet. "inline": a short bar next to text.
   */
  variant?: "block" | "inline" | "rows";
  className?: string;
};

const bar = "bg-[#ede7df]";

/** The app's loading state: skeleton bars in the shape of what is coming. */
function Loader({ label = "Loading…", variant = "block", className }: Props) {
  if (variant === "inline") {
    return (
      <span role="status" className={cn("inline-flex align-middle", className)}>
        <Skeleton className={cn("h-4 w-24", bar)} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  if (variant === "rows") {
    return (
      <div role="status" className={cn("w-full space-y-3", className)}>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4">
            <Skeleton className={cn("h-4 w-1/4", bar)} />
            <Skeleton className={cn("h-4 flex-1", bar)} />
            <Skeleton className={cn("h-4 w-1/6", bar)} />
          </div>
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div role="status" className={cn("flex w-full flex-col gap-4 p-5", className)}>
      <Skeleton className={cn("h-6 w-1/3", bar)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className={cn("h-16", bar)} />
        <Skeleton className={cn("h-16", bar)} />
        <Skeleton className={cn("h-16", bar)} />
      </div>
      <Skeleton className={cn("h-4 w-full", bar)} />
      <Skeleton className={cn("h-4 w-5/6", bar)} />
      <Skeleton className={cn("h-4 w-2/3", bar)} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Loader;
