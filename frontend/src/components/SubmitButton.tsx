

import * as Form from "@radix-ui/react-form";

import { Ripple } from "./loading-ui/ripple";


type SubmitButtonProps = {
  label?: string;
  disabled?: boolean;
  color?: string;
  /** Shows the Ripple before the label while the request is in flight. */
  loading?: boolean;
};

function SubmitButton({ label = "Submit", disabled = false, loading = false }: SubmitButtonProps) {
  return (
    <Form.Submit asChild>
      <button
        type="submit"
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-2 py-2 rounded-lg mt-5 text-white text-xl  bg-primary font-semibold
                   hover:bg-hover transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading && <Ripple className="size-6" aria-hidden />}
        {label}
      </button>
    </Form.Submit>
  );
}

export default SubmitButton; 
