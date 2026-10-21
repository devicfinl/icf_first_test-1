import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { years: number[]; value: number | null; onChange: (year: number) => void; disabled?: boolean };

/** Subscription year picker; hidden while there is only one year to choose. */
function YearSelect({ years, value, onChange, disabled }: Props) {
  if (years.length < 2) return null;

  return (
    <Select
      value={value !== null ? String(value) : undefined}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled}
    >
      <SelectTrigger aria-label="Year" className="h-10! min-w-28 rounded-full bg-white pl-4">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {years.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default YearSelect;
