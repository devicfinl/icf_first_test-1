import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Briefcase,
  Building2,
  Cake,
  CalendarDays,
  ChevronRight,
  Contact,
  Crown,
  FileX2,
  Globe,
  GraduationCap,
  Heart,
  Home,
  IdCard,
  Landmark,
  Layers,
  Lock,
  MapPin,
  MessageCircle,
  Network,
  Phone,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  UserRound,
  UsersRound,
  Droplets,
  Mail,
  Building,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InfoCard, InfoRow, ProfileDetailsSkeleton, StatusDot } from "@/components/ProfileDetails";

import { flagFor } from "../lib/flags";
import { roleLabel } from "../lib/organisation";
import { CHANGE_PASSWORD_DRAWER, withDrawer } from "../lib/drawers";
import { useAppContext } from "../context/AppContext";

/**
 * The legacy database leaves most columns blank, so a date can arrive as an ISO string, as
 * something already human-readable, or as junk. Only reformat when it actually parses.
 */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** "968" + "93621172" -> "+968 93621172"; the country code is stored separately. */
function formatPhone(code: string | null | undefined, number: string | null): string | null {
  if (!number) return null;
  return code ? `${code.startsWith("+") ? code : `+${code}`} ${number}` : number;
}

const hasValue = (values: (string | number | boolean | null | undefined)[]) =>
  values.some((value) => value !== null && value !== undefined && value !== "");

/** The signed-in member's own record, read-only. Editing lives in the legacy admin, not here. */
function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    session,
    profile,
    profileLoading,
    profileError,
    fetchProfile,
  } = useAppContext();

  useEffect(() => {
    if (!profile) void fetchProfile();
  }, [fetchProfile, profile]);

  const membershipNo = session?.membershipNo ?? null;
  const position = session?.position ?? null;

  const name = profile?.name ?? null;
  const initial = name?.trim().charAt(0).toUpperCase();
  const role = position ? roleLabel(position.designation.name, position.organisation.level) : null;

  return (
    <main className="space-y-5">
      {profileError && !profileLoading && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{profileError}</AlertDescription>
        </Alert>
      )}

      {profileLoading && !profile && <ProfileDetailsSkeleton />}

      {profile &&
        (() => {
          const { contact, address, background, organisation } = profile;
          const mobile = formatPhone(contact.mobile_country, contact.mobile);
          const hierarchy = organisation.hierarchy.filter((level) => level.level !== "International");
          const flag = flagFor(contact.country);

          return (
            <>
              {/* Header: photo, name, status chips and account actions. */}
              <section className="relative overflow-hidden rounded-2xl bg-white px-5 py-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] sm:px-8 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 right-24 hidden size-72 rounded-full bg-[#f6efe8] lg:block"
                />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
                  <div className="relative size-24 shrink-0 sm:size-28">
                    <Avatar className="size-full">
                      <AvatarImage src={profile.photo_url ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="bg-[#f3e6da] text-4xl font-semibold text-clay">
                        {initial ?? <UserRound className="size-10" />}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      aria-label={profile.is_active ? "Active" : "Inactive"}
                      className={`absolute right-1 bottom-1 size-5 rounded-full ring-4 ring-white ${profile.is_active ? "bg-emerald-500" : "bg-red-500"}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="text-[26px] leading-tight font-bold break-words text-navy sm:text-[30px]">
                      {name ?? "Member profile"}
                    </h1>
                    <p className="mt-1 text-[16px] text-[#6b6b6b]">{profile.membership_no ?? membershipNo}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-lg border border-[#ebe5de] bg-white px-3 py-1.5 text-[13px] text-navy">
                        <UserRound className="size-4" />
                        Member{profile.member_type ? ` · ${profile.member_type}` : ""}
                      </span>
                      <span
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] ${profile.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
                      >
                        <span className={`size-2 rounded-full ${profile.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                        {profile.is_active ? "Active" : "Inactive"}
                      </span>
                      {profile.is_verified && (
                        <span className="inline-flex items-center gap-2 rounded-lg border border-[#ebe5de] bg-white px-3 py-1.5 text-[13px] text-navy">
                          <ShieldCheck className="size-4 text-emerald-600" />
                          Verified
                        </span>
                      )}
                      {profile.is_transferred && (
                        <span className="inline-flex items-center gap-2 rounded-lg border border-[#ebe5de] bg-white px-3 py-1.5 text-[13px] text-navy">
                          <CalendarDays className="size-4" />
                          Transferred
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(withDrawer(location, CHANGE_PASSWORD_DRAWER))}
                      className="inline-flex items-center gap-2.5 rounded-lg border border-[#d9d4cd] bg-white px-4 py-2.5 text-[14px] text-navy transition-colors hover:bg-[#faf7f3]"
                    >
                      <Lock className="size-4" />
                      Change Password
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/deleteAccount")}
                      className="inline-flex items-center gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-[14px] text-red-600 transition-colors hover:bg-red-100"
                    >
                      <FileX2 className="size-4" />
                      Cancel Account
                    </button>
                  </div>
                </div>
              </section>

              {/* Hierarchy and the role the session is acting as. */}
              {(hierarchy.length > 0 || role) && (
                <section className="flex flex-col gap-3 rounded-2xl border border-[#e8e3dc] bg-[#f6f5f3] px-5 py-4 lg:flex-row lg:items-center">
                  {hierarchy.length > 0 && (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-2 text-[14px] text-[#6b6b6b]">
                        <Network className="size-5 text-[#2f5aa8]" />
                        Hierarchy
                      </span>
                      {hierarchy.map((level, index) => (
                        <span key={level.id} className="flex items-center gap-3 text-[15px] font-semibold text-navy uppercase">
                          {index > 0 && <ChevronRight className="size-4 text-[#555]" aria-hidden />}
                          {level.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {hierarchy.length > 0 && role && <span className="hidden h-8 w-px bg-[#d9d4cd] lg:block" />}
                  {role && (
                    <div className="flex items-center gap-3">
                      <UsersRound className="size-5 text-[#555]" />
                      <span className="text-[14px] text-[#6b6b6b]">Current Role</span>
                      <span className="text-[15px] font-semibold text-navy">{role}</span>
                    </div>
                  )}
                </section>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <InfoCard title="Member Information" icon={UserRound} tone="blue" index={1}>
                  <InfoRow icon={UserRound} label="Member Name" value={name} />
                  <InfoRow icon={IdCard} label="Membership No." value={profile.membership_no ?? membershipNo} />
                  <InfoRow icon={Layers} label="Member Type" value={profile.member_type} />
                  <InfoRow
                    icon={Activity}
                    label="Status"
                    value={
                      profile.is_active ? <StatusDot tone="green">Active</StatusDot> : <StatusDot tone="red">Inactive</StatusDot>
                    }
                  />
                </InfoCard>

                <InfoCard
                  title="Committee Information"
                  icon={UsersRound}
                  tone="orange"
                  index={2}
                  empty={!hasValue([position?.organisation.name, organisation.designation, organisation.unit?.name, role])}
                >
                  <InfoRow icon={UsersRound} label="Committee" value={position?.organisation.name} />
                  <InfoRow icon={ShieldCheck} label="Designation" value={organisation.designation} />
                  <InfoRow icon={MapPin} label="Unit" value={organisation.unit?.name} />
                  <InfoRow icon={Crown} label="Current Role" value={role} />
                  <InfoRow icon={Landmark} label="India Unit" value={organisation.india_unit} />
                  <InfoRow icon={Building} label="India Zone" value={organisation.india_zone} />
                </InfoCard>

                <InfoCard
                  title="Personal Information"
                  icon={Contact}
                  tone="blue"
                  index={3}
                  empty={
                    !hasValue([
                      profile.father_name,
                      profile.date_of_birth,
                      profile.age,
                      profile.gender,
                      profile.is_married,
                    ])
                  }
                >
                  <InfoRow icon={UserRound} label="Father's Name" value={profile.father_name} />
                  <InfoRow icon={CalendarDays} label="Date of Birth" value={formatDate(profile.date_of_birth)} />
                  <InfoRow icon={Cake} label="Age" value={profile.age ? `${profile.age} years` : null} />
                  <InfoRow icon={UserRound} label="Gender" value={profile.gender} />
                  <InfoRow
                    icon={Heart}
                    label="Marital Status"
                    value={profile.is_married === null ? null : profile.is_married ? "Married" : "Single"}
                  />
                </InfoCard>

                <InfoCard
                  title="Contact Information"
                  icon={PhoneCall}
                  tone="green"
                  index={4}
                  empty={!hasValue([contact.mobile, contact.whatsapp, contact.india_mobile, contact.email, contact.country])}
                >
                  <InfoRow icon={Phone} label="Phone Number" value={mobile} accent copy={mobile?.replace(/\s/g, "")} />
                  <InfoRow icon={MessageCircle} label="WhatsApp" value={contact.whatsapp} accent copy={contact.whatsapp ?? undefined} />
                  <InfoRow icon={Smartphone} label="India Mobile" value={contact.india_mobile} copy={contact.india_mobile ?? undefined} />
                  <InfoRow icon={Mail} label="Email" value={contact.email} accent copy={contact.email ?? undefined} />
                  <InfoRow
                    icon={Globe}
                    label="Country"
                    value={
                      contact.country && (
                        <span className="inline-flex items-center gap-2">
                          {flag && <span className="text-[17px] leading-none">{flag}</span>}
                          {contact.country}
                        </span>
                      )
                    }
                  />
                </InfoCard>

                <InfoCard
                  title="Address"
                  icon={MapPin}
                  tone="red"
                  index={5}
                  empty={
                    !hasValue([
                      address.house_name,
                      address.place,
                      address.post_office,
                      address.city,
                      address.district,
                      address.gulf_address,
                    ])
                  }
                >
                  <InfoRow icon={Home} label="House Name" value={address.house_name} />
                  <InfoRow icon={MapPin} label="Place" value={address.place} />
                  <InfoRow icon={Mail} label="Post Office" value={address.post_office} />
                  <InfoRow icon={Building2} label="City" value={address.city} />
                  <InfoRow icon={Building2} label="District" value={address.district} />
                  <InfoRow icon={Home} label="Gulf Address" value={address.gulf_address} />
                </InfoCard>

                <InfoCard
                  title="Background"
                  icon={GraduationCap}
                  tone="violet"
                  index={6}
                  empty={
                    !hasValue([background.profession, background.education, background.islamic_education, background.blood_group])
                  }
                >
                  <InfoRow icon={Briefcase} label="Profession" value={background.profession} />
                  <InfoRow icon={BookOpen} label="Education" value={background.education} />
                  <InfoRow icon={Landmark} label="Islamic Education" value={background.islamic_education} />
                  <InfoRow icon={Droplets} label="Blood Group" value={background.blood_group} />
                </InfoCard>
              </div>
            </>
          );
        })()}
    </main>
  );
}

export default ProfilePage;
