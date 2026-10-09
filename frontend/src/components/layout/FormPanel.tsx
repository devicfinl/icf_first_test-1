import type { ReactNode } from "react";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

import { useMediaQuery } from "../../hooks/useMediaQuery";

// Below Tailwind's md breakpoint (768px) forms slide up from the bottom instead.
const PHONE = "(max-width: 767px)";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** For screen readers; the form shows its own visible heading. */
  title: string;
  description?: string;
  /** Desktop panel width. Write both forms in full so Tailwind generates them. */
  widthClass?: string;
  children: ReactNode;
};

/**
 * Where a form opens: a panel from the right on tablet and desktop, and on phones a drawer from
 * the bottom that can be swiped down to close.
 */
function FormPanel({ open, onOpenChange, title, description, widthClass = "sm:max-w-md data-[side=right]:sm:max-w-md", children }: Props) {
  const phone = useMediaQuery(PHONE);
  // Without a description, say so explicitly, or Radix warns about a missing one.
  const describedBy = description ? {} : { "aria-describedby": undefined };

  if (phone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent {...describedBy} className="max-h-[92dvh] bg-cream">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {description && <DrawerDescription className="sr-only">{description}</DrawerDescription>}
          <div className="overflow-y-auto px-4 pt-3 pb-8">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        {...describedBy}
        className={`w-full overflow-y-auto bg-cream p-5 sm:p-8 data-[side=right]:w-full ${widthClass}`}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {description && <SheetDescription className="sr-only">{description}</SheetDescription>}
        {children}
      </SheetContent>
    </Sheet>
  );
}

export default FormPanel;
