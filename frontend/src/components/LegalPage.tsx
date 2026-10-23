import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";

import { useAppContext } from "../context/AppContext";

type Props = {
  title: string;
  /** Shown as "Last updated". Change it whenever the wording changes. */
  updated: string;
  children: ReactNode;
};

type TocEntry = { id: string; title: string };

/**
 * The frame for the public pages (privacy policy, terms, support, account deletion, child safety).
 * They work signed in or out; the back link goes to wherever the reader most likely came from.
 * The "On this page" list is built from the LegalSections passed in, so pages don't maintain one.
 */
function LegalPage({ title, updated, children }: Props) {
  const { session } = useAppContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const toc: TocEntry[] = Children.toArray(children).flatMap((child) =>
    isValidElement<{ id?: string; title: string }>(child) && child.type === LegalSection
      ? [{ id: child.props.id ?? slugify(child.props.title), title: child.props.title }]
      : [],
  );

  // Highlights the section nearest the top of the screen.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("section[data-legal-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [title]);

  const signedIn = Boolean(session?.token);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-foreground/8 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={signedIn ? "/dashboard" : "/login"} className="flex items-center gap-2.5">
            <img src="/logomain.png" alt="" className="h-8 w-auto" />
            <span className="font-heading text-base font-semibold text-navy">ICF FIRST</span>
          </Link>
          <Link
            to={signedIn ? "/dashboard" : "/login"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-shell"
          >
            <ArrowLeft className="size-4" />
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </div>
        <LegalTabs />
      </header>

      <div className="border-b border-foreground/8 bg-cream">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 lg:py-10">
        {toc.length > 1 && (
          <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
            <details className="group rounded-xl border border-foreground/8 lg:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground lg:pointer-events-none lg:px-0 lg:pt-0">
                On this page
                <ChevronDown className="size-4 transition-transform group-open:rotate-180 lg:hidden" />
              </summary>
              <TocList entries={toc} activeId={activeId} className="px-2 pb-3 lg:hidden" />
            </details>
            <TocList entries={toc} activeId={activeId} className="hidden lg:block" />
          </aside>
        )}

        <div
          className="max-w-3xl space-y-10 text-[15px] leading-relaxed text-foreground/90 lg:col-start-2"
        >
          {children}
        </div>
      </main>

      <footer className="border-t border-foreground/8 bg-shell">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} ICF International. All rights reserved.</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

function TocList({ entries, activeId, className }: { entries: TocEntry[]; activeId: string | null; className: string }) {
  return (
    <ol className={`space-y-0.5 text-sm ${className}`}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            aria-current={entry.id === activeId ? "location" : undefined}
            className={`block border-l-2 px-3 py-1.5 transition-colors ${
              entry.id === activeId
                ? "border-clay font-medium text-navy"
                : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            }`}
          >
            {entry.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** One tab per public page, under the top bar. Wraps onto a second line on narrow screens. */
function LegalTabs() {
  return (
    <nav aria-label="Policies" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <ul className="flex flex-wrap gap-x-5 gap-y-0 text-sm whitespace-nowrap sm:gap-x-6">
        {FOOTER_LINKS.map(([to, label]) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `-mb-px block border-b-2 py-2.5 transition-colors ${
                  isActive
                    ? "border-navy font-semibold text-navy"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "1. Our commitment" → "our-commitment", so every section can be linked to. */
function slugify(title: string) {
  return title
    .replace(/^\d+(\.\d+)*\.?\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A top-level section. It is listed in "On this page"; pass `id` to fix its #anchor. */
export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id ?? slugify(title)} data-legal-section="" className="scroll-mt-32 space-y-3">
      <h2 className="font-heading text-xl font-semibold text-navy">{title}</h2>
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

/** Where members write for help. Change it here and every page follows. */
export const SUPPORT_EMAIL = "icfintl@icfonline.org";

export function LegalContact() {
  return (
    <address className="space-y-2 rounded-xl bg-shell px-4 py-3 not-italic">
      <p className="font-semibold text-foreground">ICF International</p>
      <p>
        Email:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 underline-offset-2 hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p>
        Or contact the leaders of your higher committee in the ICF organisation (the committee above your
        unit), who can help you directly or pass your request on.
      </p>
    </address>
  );
}

const FOOTER_LINKS = [
  ["/privacyPolicy", "Privacy Policy"],
  ["/termsAndConditions", "Terms & Conditions"],
  ["/support", "Support"],
  ["/deleteAccount", "Account Deletion"],
  ["/child-safety", "Child Safety"],
] as const;

/** The links every footer carries. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
      {FOOTER_LINKS.map(([to, label]) => (
        <Link key={to} to={to} className="text-muted-foreground hover:text-foreground hover:underline">
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default LegalPage;
