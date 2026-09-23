import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Droplets,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import type { MemberProfile } from "../types/auth";

/**
 * The legacy database leaves most columns blank, so a date can arrive as an ISO string, as
 * something already human-readable, or as junk. Only reformat when it actually parses.
 */
function formatDate(value: string | null): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "+966" + "512345678" -> "+966 512345678"; the country code is stored separately. */
function formatPhone(code: string | null | undefined, number: string | null): string | null {
  if (!number) return null;
  return code ? `${code} ${number}` : number;
}

function maritalStatus(isMarried: boolean | null): string | null {
  if (isMarried === null) return null;
  return isMarried ? "Married" : "Single";
}

type RowProps = {
  label: string;
  value: string | null | undefined;
  icon?: React.ComponentType<{ className?: string }>;
};

/** One label/value pair. Anything the record left blank is dropped rather than shown empty. */
function Row({ label, value, icon: Icon }: RowProps) {
  if (!value) return null;

  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-4 shrink-0" />}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

type SectionProps = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  /** Hides the whole card when every value feeding it resolved to null. */
  empty: boolean;
  index: number;
};

function Section({ title, icon: Icon, children, empty, index }: SectionProps) {
  if (empty) return null;

  return (
    <Card
      // Inline rather than a delay-* class: the stagger is positional, and Tailwind only emits
      // classes it can find as literal text in the source.
      style={{ animationDelay: `${index * 70}ms` }}
      className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both gap-0 rounded-2xl border-foreground/8 bg-white p-0 shadow-sm duration-500 motion-reduce:animate-none"
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <span className="grid size-8 place-items-center rounded-lg bg-navy/8 text-navy">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>

      <Separator className="bg-foreground/6" />

      <div className="divide-y divide-foreground/5 px-5 py-1">{children}</div>
    </Card>
  );
}

/** Placeholder grid while the record is in flight, so the layout does not jump when it lands. */
export function ProfileDetailsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="gap-0 rounded-2xl border-foreground/8 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </Card>
      ))}
    </div>
  );
}

const hasValue = (values: (string | null | undefined)[]) => values.some(Boolean);

/** The member's record, grouped into cards. Shared by the dashboard and the profile page. */
export function ProfileDetails({ profile }: { profile: MemberProfile }) {
  const { contact, address, background, organisation } = profile;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Section
        title="Personal"
        icon={UserRound}
        index={0}
        empty={
          !hasValue([
            profile.father_name,
            profile.date_of_birth,
            profile.gender,
            maritalStatus(profile.is_married),
          ]) && !profile.age
        }
      >
        <Row label="Father's name" value={profile.father_name} />
        <Row label="Date of birth" value={formatDate(profile.date_of_birth)} icon={CalendarDays} />
        <Row label="Age" value={profile.age ? `${profile.age} years` : null} />
        <Row label="Gender" value={profile.gender} />
        <Row label="Marital status" value={maritalStatus(profile.is_married)} />
      </Section>

      <Section
        title="Contact"
        icon={Phone}
        index={1}
        empty={
          !hasValue([contact.mobile, contact.whatsapp, contact.india_mobile, contact.email, contact.country])
        }
      >
        <Row label="Mobile" value={formatPhone(contact.mobile_country, contact.mobile)} icon={Phone} />
        <Row label="WhatsApp" value={contact.whatsapp} />
        <Row label="India mobile" value={contact.india_mobile} />
        <Row label="Email" value={contact.email} icon={Mail} />
        <Row label="Country" value={contact.country} icon={MapPin} />
      </Section>

      <Section
        title="Address"
        icon={MapPin}
        index={2}
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
        <Row label="House name" value={address.house_name} />
        <Row label="Place" value={address.place} />
        <Row label="Post office" value={address.post_office} />
        <Row label="City" value={address.city} />
        <Row label="District" value={address.district} />
        <Row label="Gulf address" value={address.gulf_address} />
      </Section>

      <Section
        title="Background"
        icon={Briefcase}
        index={3}
        empty={
          !hasValue([
            background.profession,
            background.education,
            background.islamic_education,
            background.blood_group,
          ])
        }
      >
        <Row label="Profession" value={background.profession} icon={Briefcase} />
        <Row label="Education" value={background.education} icon={GraduationCap} />
        <Row label="Islamic education" value={background.islamic_education} />
        <Row label="Blood group" value={background.blood_group} icon={Droplets} />
      </Section>

      <Section
        title="Organisation"
        icon={Building2}
        index={4}
        empty={
          !hasValue([
            organisation.unit?.name,
            organisation.designation,
            organisation.india_unit,
            organisation.india_zone,
          ]) && organisation.hierarchy.length === 0
        }
      >
        <Row label="Unit" value={organisation.unit?.name} icon={Building2} />
        <Row label="Designation" value={organisation.designation} icon={ShieldCheck} />
        <Row label="India unit" value={organisation.india_unit} />
        <Row label="India zone" value={organisation.india_zone} />

        {organisation.hierarchy.length > 0 && (
          <div className="py-2.5">
            <span className="text-sm text-muted-foreground">Hierarchy</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {organisation.hierarchy.map((level) => (
                <Badge
                  key={level.id}
                  variant="outline"
                  className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                >
                  {level.name ?? level.level}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

/** The status chips shown next to a member's name, on both the dashboard and the profile page. */
export function ProfileStatusBadges({ profile }: { profile: MemberProfile | null }) {
  if (!profile) return null;

  return (
    <>
      {profile.member_type && (
        <Badge variant="outline" className="rounded-full px-3 py-1">
          {profile.member_type}
        </Badge>
      )}
      {profile.is_verified && (
        <Badge
          variant="outline"
          className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
        >
          <BadgeCheck />
          Verified
        </Badge>
      )}
      {!profile.is_active && (
        <Badge variant="destructive" className="rounded-full px-3 py-1">
          Inactive
        </Badge>
      )}
      {profile.is_transferred && (
        <Badge variant="outline" className="rounded-full px-3 py-1">
          Transferred
        </Badge>
      )}
    </>
  );
}
