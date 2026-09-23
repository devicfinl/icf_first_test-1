import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { RootState } from "../store/store";

type Props = {
  title: string;
  /** Shown as "Last updated". Change it whenever the wording changes. */
  updated: string;
  children: ReactNode;
};

/**
 * The frame for the privacy policy and terms. Both are public, so they work signed in or out; the
 * back link goes to wherever the reader most likely came from.
 */
function LegalPage({ title, updated, children }: Props) {
  const token = useSelector((state: RootState) => state.auth.token);

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
        <Link
          to={token ? "/dashboard" : "/login"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {token ? "Back to dashboard" : "Back to sign in"}
        </Link>

        <Card className="mt-4 gap-0 overflow-hidden rounded-2xl border-foreground/8 bg-white p-0 shadow-sm">
          <header className="flex flex-col items-center gap-3 bg-gradient-to-r from-navy to-navy-deep px-6 py-8 text-center text-white">
            <img src="/logomain.png" alt="ICF International" className="h-auto w-24 rounded-lg bg-white p-2" />
            <p className="text-sm font-medium tracking-wide text-white/80">ICF FIRST</p>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
            <p className="text-sm text-white/70">Last updated: {updated}</p>
          </header>

          <div className="space-y-8 px-5 py-8 text-[15px] leading-relaxed text-foreground/90 sm:px-10">
            {children}
          </div>

          <footer className="border-t border-foreground/8 px-5 py-5 text-center text-xs text-muted-foreground sm:px-10">
            <LegalLinks className="mb-2 justify-center" />© {new Date().getFullYear()} ICF International. All
            rights reserved.
          </footer>
        </Card>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
}

export function LegalSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

/** A list of "Label: description" items, the shape most of both documents is written in. */
export function LegalList({ items }: { items: [label: string, text: string][] | string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-clay">
      {items.map((item) =>
        typeof item === "string" ? (
          <li key={item}>{item}</li>
        ) : (
          <li key={item[0]}>
            <span className="font-medium text-foreground">{item[0]}:</span> {item[1]}
          </li>
        ),
      )}
    </ul>
  );
}

export function LegalContact() {
  return (
    <address className="rounded-xl bg-shell px-4 py-3 not-italic">
      <p className="font-semibold text-foreground">ICF International</p>
      <p>
        Email:{" "}
        <a href="mailto:icfintl@icfonline.org" className="text-blue-700 underline-offset-2 hover:underline">
          icfintl@icfonline.org
        </a>
      </p>
    </address>
  );
}

/** The two links every footer carries. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
      <Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground hover:underline">
        Privacy Policy
      </Link>
      <Link to="/terms" className="text-muted-foreground hover:text-foreground hover:underline">
        Terms &amp; Conditions
      </Link>
    </nav>
  );
}

export default LegalPage;
