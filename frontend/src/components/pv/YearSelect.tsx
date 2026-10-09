import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Props = { years: number[]; value: number | null; onChange: (year: number) => void };

/** Subscription year picker; hidden while there is only one year to choose. */
function YearSelect({ years, value, onChange }: Props) {
  if (years.length < 2) return null;

  return (
    <NativeSelect
      aria-label="Year"
      value={value ?? ""}
      onChange={(event) => onChange(Number(event.target.value))}
      className="[&_select]:h-10 [&_select]:rounded-full [&_select]:bg-white [&_select]:pl-4"
    >
      {years.map((year) => (
        <NativeSelectOption key={year} value={year}>
          {year}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export default YearSelect;
