import { useId } from "react";

import { Switch } from "@/components/ui/switch";

type Props = {
  /** What the switch answers, for screen readers, e.g. "Is ICF Member". */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** A yes/no question as a switch, with "Yes" or "No" written beside it. */
function YesNoSwitch({ label, checked, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="cursor-pointer text-sm font-medium text-navy">
        {checked ? "Yes" : "No"}
      </label>
    </div>
  );
}

export default YesNoSwitch;
