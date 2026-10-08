import { useState } from "react";
import { Building2, ChevronRight, ChevronsUpDown, Flag, Globe, Landmark, MapPin, Network, type LucideIcon } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { flagFor } from "../../lib/flags";
import type { OrganisationLevel } from "../../types/auth";

const LEVEL_STYLE: Record<string, { icon: LucideIcon; tile: string }> = {
  International: { icon: Globe, tile: "bg-[#e7edf6] text-navy" },
  National: { icon: Flag, tile: "bg-white text-navy ring-1 ring-black/5" },
  Chapter: { icon: Building2, tile: "bg-[#f6ece2] text-clay" },
  Region: { icon: MapPin, tile: "bg-[#e3ecfb] text-[#2f5aa8]" },
  Division: { icon: Network, tile: "bg-[#efedea] text-[#5b5650]" },
  Unit: { icon: Landmark, tile: "bg-[#f6ece2] text-clay" },
};

function PlaceIcon({ place, large = false }: { place: OrganisationLevel; large?: boolean }) {
  const style = LEVEL_STYLE[place.level ?? ""] ?? { icon: MapPin, tile: "bg-[#f3ebe2] text-clay" };
  const flag = place.level === "National" ? flagFor(place.name) : null;
  const Icon = style.icon;

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg ${large ? "size-9" : "size-8"} ${style.tile}`}
      aria-hidden
    >
      {flag ? (
        <span className={large ? "text-[18px] leading-none" : "text-[16px] leading-none"}>{flag}</span>
      ) : (
        <Icon className={large ? "size-[18px]" : "size-4"} />
      )}
    </span>
  );
}

/** A bare icon for a level, in the text's colour (the flag for a country), as in the header trail. */
function InlineIcon({ place }: { place: OrganisationLevel }) {
  const flag = place.level === "National" ? flagFor(place.name) : null;
  if (flag) return <span className="text-[17px] leading-none" aria-hidden>{flag}</span>;
  const Icon = (LEVEL_STYLE[place.level ?? ""] ?? { icon: MapPin }).icon;
  return <Icon className="size-[18px] shrink-0" strokeWidth={2.25} aria-hidden />;
}

/** A place's small level caption over its name, e.g. "REGION" / "Muscat". */
function PlaceLabel({ place, active }: { place: OrganisationLevel; active: boolean }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className={`text-[10px] font-medium tracking-[0.08em] uppercase ${active ? "text-clay" : "text-[#8a847c]"}`}>
        {place.level}
      </span>
      <span className={`truncate text-[14px] ${active ? "font-semibold text-navy" : "font-medium text-[#3d3a36]"}`}>
        {place.name ?? "—"}
      </span>
    </span>
  );
}

/**
 * Where the current position sits, inside the header: International down to the
 * position's place (the last, in bold). On phones and tablets only the current place shows;
 * tapping it lists the whole path in a drawer.
 */
function HierarchyBreadcrumb({ path }: { path: OrganisationLevel[] }) {
  const [open, setOpen] = useState(false);
  const active = path.at(-1)!;

  return (
    <nav aria-label="Organisation hierarchy" className="min-w-0">
      {/* Desktop: icon and name for each level, chevrons between; the current place in the accent colour. */}
      <ol className="hidden min-w-0 items-center gap-x-3 lg:flex">
        {path.map((place, index) => {
          const isActive = index === path.length - 1;
          return (
            <li key={place.id} className="flex min-w-0 items-center gap-x-3">
              {index > 0 && <ChevronRight className="size-4 shrink-0 text-[#3d3a36]" strokeWidth={2.5} aria-hidden />}
              <span
                aria-current={isActive ? "location" : undefined}
                title={place.level ?? undefined}
                className={`flex max-w-[200px] min-w-0 items-center gap-2 text-[15px] font-medium ${
                  isActive ? "text-clay" : "text-[#2b2926]"
                }`}
              >
                <InlineIcon place={place} />
                <span className="truncate">{place.name ?? "—"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Phone and tablet: the current place; tapping it shows the whole path. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Organisation hierarchy: ${path.map((place) => place.name).join(", ")}`}
        className="flex max-w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[15px] font-medium text-clay hover:bg-white/50 lg:hidden"
      >
        <InlineIcon place={active} />
        <span className="truncate">{active.name ?? "—"}</span>
        {path.length > 1 && <ChevronsUpDown className="size-3.5 shrink-0 text-[#8a847c]" aria-hidden />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-cream px-5 pb-8 lg:hidden">
          <SheetHeader className="px-0">
            <SheetTitle className="text-navy">Organisation hierarchy</SheetTitle>
            <SheetDescription>Where your current position sits.</SheetDescription>
          </SheetHeader>
          <ol className="space-y-2">
            {path.map((place, index) => {
              const isActive = index === path.length - 1;
              return (
                <li key={place.id}>
                  <span
                    aria-current={isActive ? "location" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      isActive ? "bg-white shadow-[0_2px_8px_rgba(20,44,80,0.08)] ring-1 ring-black/[0.04]" : "bg-white/60"
                    }`}
                  >
                    <PlaceIcon place={place} large />
                    <PlaceLabel place={place} active={isActive} />
                  </span>
                </li>
              );
            })}
          </ol>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

export default HierarchyBreadcrumb;
