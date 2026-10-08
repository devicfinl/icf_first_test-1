import { useFormContext } from "react-hook-form";

import type { AddSubscriberFormData, AddSubscriberFormInput } from "../utilities/validation";

/** The Add Subscriber form, for the step components rendered inside its FormProvider. */
export function useSubscriberForm() {
  return useFormContext<AddSubscriberFormInput, unknown, AddSubscriberFormData>();
}
