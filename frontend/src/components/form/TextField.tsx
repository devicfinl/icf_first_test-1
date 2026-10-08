import type { ComponentProps } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = ComponentProps<typeof Input> & { id: string; label: string; error?: string; required?: boolean };

/** A labelled text input with its error message. Pass register() props straight through. */
function TextField({ id, label, error, required, className, ...inputProps }: Props) {
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Input id={id} aria-invalid={error ? true : undefined} className="h-10" {...inputProps} />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export default TextField;
 