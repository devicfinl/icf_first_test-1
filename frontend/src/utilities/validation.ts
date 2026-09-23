import { z } from "zod";

// These mirror backend/src/modules/auth/auth.schema.ts. They exist to catch mistakes before a
// round trip, not to enforce the rules — the server validates everything again and its answer wins.

// Membership numbers are 2 letters followed by 7 digits (e.g. "OM2400110"). Mirrors
// backend/src/modules/auth/auth.schema.ts; the server validates again and its answer wins.
const USERNAME_PATTERN = /^[A-Z]{2}\d{7}$/;

export const loginSchema = z.object({
  // users.user_name is the membership number, so that is what a member signs in with.
  userName: z.string().trim().min(1, "Username is wrong").regex(USERNAME_PATTERN, "Username is wrong"),
  password: z.string().min(1, "Please enter your password."),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Please enter your current password."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(200, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Your new password must be different from your current one.",
    path: ["newPassword"],
  });
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
