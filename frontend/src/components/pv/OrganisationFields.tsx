import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import FormSection from "../form/FormSection";
import Loader from "../loading-ui/Loader";
import TextField from "../form/TextField";
import { levelLabel } from "../../lib/pv";
import type { OrgLevel } from "../../hooks/useOrganisationLevels";
import type { OrgPlace } from "../../types/pv";

type Props = {
  /** The leader's fixed places, from the country down. */
  path: OrgPlace[];
  /** The dropdowns below the leader's place. */
  levels: OrgLevel[];
  onChoose: (index: number, placeId: number | null) => void;
  /** Shown when no unit has been chosen. */
  error?: string;
};

/** Organization Information: fixed places above the leader, then a dropdown per level down to Unit. */
function OrganisationFields({ path, levels, onChoose, error }: Props) {
  return (
    <FormSection title="Organization Information">
      {path.map((place) => (
        <TextField
          key={place.id}
          id={`org-${place.id}`}
          label={levelLabel(place.level)}
          value={place.name ?? ""}
          disabled
          readOnly
        />
      ))}

      {levels.map((level, index) => {
        const label = levelLabel(level.options[0]?.level);
        const id = `org-level-${index}`;
        return (
          <Field key={`${level.parentId}-${index}`}>
            <FieldLabel htmlFor={id}>
              {level.loading ? <Loader variant="inline" label={label} className="text-foreground" /> : label}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <NativeSelect
              id={id}
              className="w-full [&>select]:h-10"
              value={level.selected ?? ""}
              disabled={level.loading}
              onChange={(event) => onChoose(index, event.target.value ? Number(event.target.value) : null)}
            >
              <NativeSelectOption value="">
                {level.loading ? "Loading…" : level.options.length ? `Choose ${label.toLowerCase()}` : "None found"}
              </NativeSelectOption>
              {level.options.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.name ?? `#${option.id}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        );
      })}

      {error && <FieldError className="md:col-span-2">{error}</FieldError>}
    </FormSection>
  );
}

export default OrganisationFields;
