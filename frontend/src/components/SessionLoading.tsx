import LogoLoader from "./loading-ui/LogoLoader";

/** Shown by the guarded screens while a stored session is verified on load. */
function SessionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream">
      <LogoLoader size={96} label="" showText />
    </main>
  );
}

export default SessionLoading;
