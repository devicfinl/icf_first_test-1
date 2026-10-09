import { cn } from "cn"

import { Ripple } from "@/components/loading-ui/ripple"

// The app-wide loading indicator is the loading-ui Ripple; Spinner keeps its name and props so
// every existing use (buttons, search, session check) shows it.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return <Ripple data-slot="spinner" role="status" aria-label="Loading" className={cn("size-5", className)} {...props} />
}

export { Spinner }
