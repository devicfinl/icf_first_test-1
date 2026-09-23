import * as Form from "@radix-ui/react-form";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Props = Omit<ComponentPropsWithoutRef<"input">, "className"> & {
  name: string;
  label: string;
  error?: string;
  rightSlot?: ReactNode;
};

export const FormInput = forwardRef<HTMLInputElement, Props>(
  ({ error, label, rightSlot, name, type = "text", ...inputProps }, ref) => (
    <Form.Field name={name} className="space-y-2 mb-5">
      <Form.Label className="block text-sm font-medium text-gray-700">{label}</Form.Label>

      <div className="relative">
        <Form.Control asChild>
          {/* The rest of the props are spread through so react-hook-form's onBlur, onChange and
              ref all reach the input; dropping onBlur would break validation on blur. */}
          <input
            {...inputProps}
            ref={ref}
            name={name}
            type={type}
            aria-invalid={error ? true : undefined}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
            } ${rightSlot ? "pr-11" : ""}`}
          />
        </Form.Control>

        {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </Form.Field>
  ),
);

FormInput.displayName = "FormInput";
