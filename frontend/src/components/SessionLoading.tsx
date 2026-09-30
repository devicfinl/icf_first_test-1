import { Spinner } from "@/components/ui/spinner";

/** Shown by the guarded screens while a stored session is verified on load. */
function SessionLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream">
      <Spinner className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Checking your session…</p>
    </main>
  );
}

export default SessionLoading;
