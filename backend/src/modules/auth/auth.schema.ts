import { z } from "zod";

// Request shapes for the auth endpoints. z.strictObject rejects unknown fields, so a client can't
// send extra properties hoping a later version starts reading them.
//
// The messages here are what the caller sees on a 400, so they are written for a member, not a
// developer. Anything that depends on the database (does this member exist, is this the right
// password) is not validation and stays in the service, as a 401.

// `error` covers the missing and wrong-type cases too. Without it a absent field reports zod's
// own "expected string, received undefined", which is not something to show a member.
const text = (message: string) => z.string({ error: message });

// Membership numbers are 2 letters followed by 7 digits (e.g. "OM2400110"). This is checked here
// purely as a syntax rule, before any lookup happens, so rejecting a bad format never reveals
// whether an account exists.
const USERNAME_PATTERN = /^[A-Z]{2}\d{7}$/;

export const loginBody = z.strictObject({
  userName: text("Username is wrong")
    .trim()
    .min(1, "Username is wrong")
    .regex(USERNAME_PATTERN, "Username is wrong"),
  password: text("Please enter your password.").min(1, "Please enter your password."),
});

export const selectPositionBody = z.strictObject({
  positionId: z.coerce
    .number({ error: "Please choose one of your committee positions." })
    .int("Please choose one of your committee positions.")
    .positive("Please choose one of your committee positions."),
});

const newPassword = text("Please enter a new password.")
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.");

// Changing a password while signed in. The current password is required so that a walk-up on an
// unlocked browser (or a stolen token) can't silently take the account over.
export const changePasswordBody = z
  .strictObject({
    currentPassword: text("Please enter your current password.").min(1, "Please enter your current password."),
    newPassword,
    confirmPassword: text("Please confirm your new password.").min(1, "Please confirm your new password."),
  })
  .refine((body) => body.newPassword === body.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((body) => body.newPassword !== body.currentPassword, {
    message: "Your new password must be different from your current one.",
    path: ["newPassword"],
  });

export type LoginBody = z.infer<typeof loginBody>;
export type SelectPositionBody = z.infer<typeof selectPositionBody>;
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;
