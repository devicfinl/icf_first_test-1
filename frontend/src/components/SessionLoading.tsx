import Loader from "./loading-ui/Loader";

/** Shown by the guarded screens while a stored session is verified on load. */
function SessionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream">
      <Loader label="Checking your session…" />
    </main>
  );
}

export default SessionLoading;
