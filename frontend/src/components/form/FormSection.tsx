import type { ReactNode } from "react";

/** A titled group of form fields, two columns from tablet width up. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-base font-semibold text-navy">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default FormSection;
