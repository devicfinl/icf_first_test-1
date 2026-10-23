import { z } from "zod";

// These mirror the schemas in backend/src/modules/auth/auth.controller.ts. They exist to catch mistakes before a
// round trip, not to enforce the rules — the server validates everything again and its answer wins.

// Membership numbers are 2 letters followed by 7 digits.
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

export const cancelAccountSchema = z.object({
  currentPassword: z.string().min(1, "Please enter your current password."),
  confirm: z.literal(true, { error: "Please confirm that you want to cancel your account." }),
});
export type CancelAccountFormData = z.infer<typeof cancelAccountSchema>;

// The public child safety report form. There is no backend for it yet (see ChildSafetyReportForm).
export const CHILD_SAFETY_CONCERNS = [
  "Child sexual abuse material (CSAM)",
  "Grooming or sexual exploitation of a child",
  "Sextortion or trafficking",
  "Account used by or for a child",
  "Other child safety concern",
] as const;

export const childSafetyReportSchema = z.object({
  concern: z.enum(CHILD_SAFETY_CONCERNS, { error: "Please choose what you are reporting." }),
  details: z
    .string()
    .trim()
    .min(20, "Please describe what you saw in at least 20 characters.")
    .max(4000, "Please keep the description under 4000 characters."),
  where: z.string().trim().max(500, "Please keep this under 500 characters.").optional(),
  name: z.string().trim().max(200, "Name is too long.").optional(),
  email: z.union([z.literal(""), z.email("Please enter a valid email address.")]).optional(),
});
export type ChildSafetyReportFormData = z.infer<typeof childSafetyReportSchema>;

// Add Subscriber (Pravasi Vayana). Mirrors registrationBody in backend/src/modules/pv/pv.controller.ts.
// Every field is a string in the form; empty optional fields are dropped before sending.
const pvRequired = (label: string) =>
  z.string().trim().min(1, `Please enter ${label}.`).max(500, `${label[0]!.toUpperCase()}${label.slice(1)} is too long.`);
const pvOptional = (label: string) =>
  z.string().trim().max(500, `${label[0]!.toUpperCase()}${label.slice(1)} is too long.`);

export const addSubscriberSchema = z
  .object({
    // Find step
    // Y: renewing the existing subscriber chosen with the lookup (subscriberId).
    // "": not answered yet (the leader's find step starts so, and must be answered to continue).
    isExisting: z.enum(["", "Y", "N"]),
    subscriberId: z.number().int().positive().optional(),
    // Asked of new and renewing subscribers (leader's form only); Yes needs the membership number.
    isIcfMember: z.enum(["", "Yes", "No"]),
    membershipId: z.string().trim().toUpperCase(),
    // Details step
    unitId: z.number({ error: "Please choose a unit." }).int().positive("Please choose a unit."),
    name: pvRequired("the full name"),
    shopName: pvOptional("the flat/villa/shop name"),
    floorNo: pvOptional("the floor number"),
    buildingName: pvRequired("the building name"),
    street: pvOptional("the street"),
    area: pvOptional("the area"),
    province: pvRequired("the state/province/emirate"),
    mobileCountry: z
      .string()
      .trim()
      .regex(/^\+?\d{1,4}$/, "Please enter the mobile country code."),
    mobile: z
      .string()
      .transform((value) => value.replace(/[\s()-]/g, ""))
      .pipe(z.string().regex(/^\d{6,15}$/, "Please enter a valid mobile number.")),
    whatsappCountry: z
      .string()
      .trim()
      .regex(/^(\+?\d{1,4})?$/, "Please enter the WhatsApp country code."),
    whatsapp: z
      .string()
      .transform((value) => value.replace(/[\s()-]/g, ""))
      .pipe(z.string().regex(/^(\d{6,15})?$/, "Please enter a valid WhatsApp number.")),
    email: z.union([z.literal(""), z.email("Please enter a valid email address.").max(320)]),
    contactPersonName: pvOptional("the contact person / sponsor"),
    // Step 2
    subscriptionMode: z.enum(["Print", "Digital"], {
      error: "Please choose a subscription mode.",
    }),
    distributorArea: pvOptional("the distribution lead"),
    deliveryResponsibility: pvOptional("the delivery responsibility"),
    cashReceived: z.enum(["Y", "N"]),
  })
  .refine((data) => !(data.whatsapp && !data.whatsappCountry), {
    message: "Please enter the WhatsApp country code.",
    path: ["whatsappCountry"],
  })
  .refine((data) => data.isIcfMember !== "Yes" || USERNAME_PATTERN.test(data.membershipId), {
    message: "Please enter a valid membership number, e.g. OM0001234.",
    path: ["membershipId"],
  });
export type AddSubscriberFormInput = z.input<typeof addSubscriberSchema>;
export type AddSubscriberFormData = z.output<typeof addSubscriberSchema>;

/** The leader's first step: is this an existing subscriber, or an ICF member. */
export const ADD_SUBSCRIBER_FIND_FIELDS = ["isExisting", "subscriberId", "isIcfMember", "membershipId"] as const;

/** The details step, validated before moving on to the subscription. */
export const ADD_SUBSCRIBER_STEP1_FIELDS = [
  "unitId",
  "name",
  "shopName",
  "floorNo",
  "buildingName",
  "street",
  "area",
  "province",
  "mobileCountry",
  "mobile",
  "whatsappCountry",
  "whatsapp",
  "email",
  "contactPersonName",
] as const;
