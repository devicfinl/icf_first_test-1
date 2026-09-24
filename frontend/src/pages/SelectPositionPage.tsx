import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, UserRound, UsersRound } from "lucide-react";
import toast from "react-hot-toast";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

import {
  fetchPositions,
  fetchProfile,
  selectPosition,
} from "../thunks/authThunk";
import type { AppDispatch, RootState } from "../store/store";
import type { MemberPosition } from "../types/auth";
import { toNormalCase } from "../utilities/textCase";

const THEMES = [
  {
    iconBg: "bg-[#142C50]",
    badgeBg: "bg-[#142C50]",
  },
  {
    iconBg: "bg-[#945627]",
    badgeBg: "bg-[#945627]",
  },
] as const;

function committeeLabel(level: string | null): string {
  return level ? `${toNormalCase(level)} Committee` : "Committee";
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="size-16 rounded-2xl" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="mt-5 space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/5" />
      </div>

      <div className="mt-6 flex justify-end">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

type CardProps = {
  position: MemberPosition;
  theme: (typeof THEMES)[number];
  selected: boolean;
  onSelect: () => void;
  onContinue: () => void;
  index: number;
};

function PositionCard({
  position,
  theme,
  selected,
  onSelect,
  onContinue,
  index,
}: CardProps) {
  const { designation, organisation } = position;
  const desigTitle = toNormalCase(designation.name);
  const orgLevel = organisation.level
    ? toNormalCase(organisation.level).toUpperCase()
    : "POSITION";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`
        group relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200
        cursor-pointer text-left select-none
        animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-400
        ${
          selected
            ? "border-2 border-[#8A481B] bg-white shadow-sm ring-1 ring-[#8A481B]/20"
            : "border border-slate-200/90 bg-[#FDFBF9] hover:border-slate-300 hover:bg-white"
        }
      `}
    >
      <div>
        {/* Top: Icon & Level Badge */}
        <div className="flex items-start justify-between gap-4">
          <div
            className={`
              grid size-16 shrink-0 place-items-center rounded-2xl text-white shadow-sm
              ${theme.iconBg}
            `}
          >
            <UserRound className="size-8" strokeWidth={1.8} aria-hidden />
          </div>

          <span
            className={`
              rounded-full px-4 py-1 text-[11px] font-bold tracking-wider text-white shadow-xs
              ${theme.badgeBg}
            `}
          >
            {orgLevel}
          </span>
        </div>

        {/* Middle Info */}
        <div className="mt-5">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">
            {desigTitle}
          </h3>

          <p className="mt-1 text-sm font-semibold text-slate-800">
            {committeeLabel(organisation.level)}
          </p>

          <div className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-slate-800">
            <MapPin className="size-4 shrink-0 text-slate-700" />
            <span className="truncate">
              {toNormalCase(organisation.name) || "General"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Link Action */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContinue();
          }}
          className="group/btn inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#1e509c] hover:text-[#142C50] transition-colors"
        >
          <span>Continue As {desigTitle}</span>
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function SelectPositionPage() {
  const navigate = useNavigate();
  // LoginPage passes the member's name along so the greeting shows without waiting on the profile.
  const nameFromLogin = (useLocation().state as { name?: string } | null)?.name ?? null;
  const dispatch = useDispatch<AppDispatch>();

  const {
    token,
    positions,
    requiresPositionSelection,
    loading,
    error,
    profile,
  } = useSelector((state: RootState) => state.auth);

  const [chosenId, setChosenId] = useState<number | null>(null);

  useEffect(() => {
    if (token && positions.length === 0) {
      void dispatch(fetchPositions());
    }
  }, [dispatch, token, positions.length]);

  useEffect(() => {
    // Only needed when the page was opened without the login state (e.g. a direct visit).
    if (token && !nameFromLogin && !profile) {
      void dispatch(fetchProfile());
    }
  }, [dispatch, token, nameFromLogin, profile]);

  const selectedId = chosenId ?? positions[0]?.id ?? null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!requiresPositionSelection) {
    return <Navigate to="/dashboard" replace />;
  }

  async function choose(position: MemberPosition) {
    setChosenId(position.id);

    try {
      await dispatch(selectPosition(position.id)).unwrap();
      toast.success(`Signed in as ${toNormalCase(position.designation.name)}`);
      navigate("/dashboard", { replace: true });
    } catch {
      // Handled in store
    }
  }

  const selected =
    positions.find((position) => position.id === selectedId) ?? null;

  const name = nameFromLogin ?? profile?.name ?? null;

  return (
    <main className="min-h-screen bg-[#F8F5F0] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
        {/* Intro / Header */}
        <div className="text-center animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-400">
          <p className="text-xs sm:text-sm font-bold tracking-wide text-[#A15D2D]">
            Welcome To ICF Portal
          </p>

          <h1 className="mt-1 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            {toNormalCase(name) || "Member Name"}
          </h1>

          <div className="mt-3 text-xs sm:text-sm font-normal text-slate-600 leading-relaxed">
            <p>
              {positions.length > 1
                ? "you have multiple positions."
                : "your member position."}
            </p>
            <p>Please select the postion you want to sign as</p>
          </div>

          <h2 className="mt-2 text-base sm:text-lg font-bold text-slate-950">
            Which position would you like to Continue with?
          </h2>
        </div>

        {/* Outer White Card Container */}
        <div className="mt-6 sm:mt-7 w-full max-w-[760px] rounded-[28px] border border-[#E7E2D9] bg-white p-6 sm:p-9 shadow-[0_4px_25px_rgba(0,0,0,0.03)] animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500">
          {positions.length === 0 ? (
            loading ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : (
              <Empty className="rounded-2xl border border-slate-200 bg-white py-12 shadow-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersRound aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No positions found</EmptyTitle>
                  <EmptyDescription>
                    No committee positions are linked to this membership yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {positions.map((pos, index) => (
                <PositionCard
                  key={pos.id}
                  position={pos}
                  theme={THEMES[index % THEMES.length]!}
                  selected={pos.id === selectedId}
                  onSelect={() => setChosenId(pos.id)}
                  onContinue={() => void choose(pos)}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mt-6 rounded-xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Bottom Action Button */}
          {positions.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                disabled={!selected || loading}
                onClick={() => selected && void choose(selected)}
                className="
                  h-12 min-w-64 rounded-xl px-8
                  bg-[#142C50] text-white font-semibold text-sm sm:text-base
                  shadow-sm transition-all duration-200
                  hover:bg-[#0E1F3A] hover:shadow hover:-translate-y-0.5
                  active:translate-y-0 active:scale-[0.99]
                  disabled:opacity-50 disabled:pointer-events-none
                "
              >
                {loading && <Spinner className="mr-2" />}
                {loading ? "Signing in..." : "Continue With Selected Role"}
                {!loading && (
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover/button:translate-x-0.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default SelectPositionPage;