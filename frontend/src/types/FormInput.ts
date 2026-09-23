export type FormInputProps = {
  name: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
 error?: string;
  rightSlot?: React.ReactNode;
};