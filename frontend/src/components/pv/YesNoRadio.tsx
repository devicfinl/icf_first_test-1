import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Props<T extends string> = {
  /** What the choice answers, for screen readers, e.g. "Is ICF Member". */
  label: string;
  /** The stored values for Yes and No, e.g. ["Y", "N"]. */
  values: readonly [yes: T, no: T];
  /** "" (or anything else) when not answered yet: neither is chosen. */
  value: string | undefined;
  onChange: (value: T) => void;
  invalid?: boolean;
};

/** A required yes/no question as two radio buttons; neither is chosen until answered. */
function YesNoRadio<T extends string>({ label, values, value, onChange, invalid }: Props<T>) {
  return (
    <RadioGroup aria-label={label} value={value ?? ""} onValueChange={(next) => onChange(next as T)} className="flex gap-6">
      {values.map((option, index) => (
        <label key={option} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy">
          <RadioGroupItem value={option} aria-invalid={invalid ? true : undefined} />
          {index === 0 ? "Yes" : "No"}
        </label>
      ))}
    </RadioGroup>
  );
}

export default YesNoRadio;
