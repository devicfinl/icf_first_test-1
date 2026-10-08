import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { OrgPlace } from "../../types/pv";

// What a visitor chooses below each kind of leader's place.
const CHOICES: Record<string, string> = {
  Region: "their division and unit",
  Division: "their unit",
  Unit: "nothing: the unit is already set",
};

/** The leader's public registration link, to copy and share. */
function PublicLinkCard({ place }: { place: OrgPlace }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/pv/register/${place.id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API refused (insecure origin or permissions): copy the selected input instead.
      const input = document.getElementById("public-link") as HTMLInputElement | null;
      input?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-2xl bg-white px-5 py-5 sm:px-6">
      <h2 className="text-[17px] font-semibold text-navy">Public registration link</h2>
      <p className="mt-1 text-[13px] text-[#6b6b6b]">
        Anyone with this link can subscribe under {place.name ?? "your place"} without logging in. They choose{" "}
        {CHOICES[place.level ?? ""] ?? "their unit"}. Each registration waits below until you approve it.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input id="public-link" value={link} readOnly onFocus={(event) => event.target.select()} className="h-10 bg-[#faf7f3]" />
        <div className="flex gap-2">
          <Button type="button" onClick={() => void copy()} className="h-10 flex-1 rounded-full px-5 sm:flex-none">
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-full px-4">
            <a href={link} target="_blank" rel="noreferrer" aria-label="Open link">
              <ExternalLink />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default PublicLinkCard;
