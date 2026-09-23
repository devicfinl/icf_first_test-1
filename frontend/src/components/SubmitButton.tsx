

import * as Form from "@radix-ui/react-form";


type SubmitButtonProps = {
  label?: string;
  disabled?: boolean;
  color?: string;
};

function SubmitButton({ label = "Submit", disabled = false }: SubmitButtonProps) {
  return (
    <Form.Submit asChild>
      <button
        type="submit"
        disabled={disabled}
        className={`w-full py-2 rounded-lg mt-5 text-white text-xl  bg-primary font-semibold
                   hover:bg-hover transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {label}
      </button>
    </Form.Submit>
  );
}

export default SubmitButton; 
