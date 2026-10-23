interface LogoLoaderProps {
  /** Width in px. Height is calculated from the logo's aspect ratio. */
  size?: number;
  className?: string;
  /** Show the visible "Loading…" label under the logo. */
  showText?: boolean;
  /** Text for the label and for screen readers. */
  label?: string;
  /** One animation cycle, in seconds. */
  speed?: number;
  /** Center the loader on a full-screen overlay. */
  fullScreen?: boolean;
}

const VIEWBOX_W = 334;
const VIEWBOX_H = 193;

// Plain <style> (not styled-jsx) so it works in any React setup (Vite, CRA, Next).
// Classes instead of ids, so several loaders on one page don't clash.
const css = `
.icf-loader {
  overflow: visible;
}
.icf-loader .icf-part {
  /* Makes transform-origin relative to each shape's own box (needed for Safari) */
  transform-box: fill-box;
  transform-origin: center;
  animation: icf-wave var(--icf-speed, 1.1s) cubic-bezier(0.4, 0, 0.2, 1) infinite both;
  will-change: transform, opacity;
}
.icf-loader .icf-navy  { fill: currentColor; }
.icf-loader .icf-clay  { fill: var(--icf-accent, #9c5722); }

/* Negative delays: every shape is already mid-cycle on the first frame,
   so there is no flash of full-opacity shapes before the animation starts.
   Order: right dot -> navy chevron -> clay chevron -> diamonds -> left dot */
.icf-loader .icf-dot-r       { animation-name: icf-flash; animation-delay: calc(var(--icf-speed, 1.1s) * -1); }
.icf-loader .icf-chevron-1   { animation-delay: calc(var(--icf-speed, 1.1s) * -0.85); }
.icf-loader .icf-chevron-2   { animation-delay: calc(var(--icf-speed, 1.1s) * -0.70); }
.icf-loader .icf-diamond     { animation-delay: calc(var(--icf-speed, 1.1s) * -0.55); }
.icf-loader .icf-dot-l       { animation-name: icf-flash; animation-delay: calc(var(--icf-speed, 1.1s) * -0.40); }

@keyframes icf-wave {
  0%, 100% { opacity: 0.35; transform: translateX(0); }
  35%      { opacity: 1;    transform: translateX(-12px); }
  70%      { opacity: 0.5;  transform: translateX(-3px); }
}
@keyframes icf-flash {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  30%      { opacity: 1;    transform: scale(1.25); }
}
@keyframes icf-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .icf-loader .icf-part {
    animation: icf-breathe 1.8s ease-in-out infinite both;
    transform: none;
  }
}
`;

export default function LogoLoader({
  size = 72,
  className = '',
  showText = false,
  label = 'Loading',
  speed = 1.1,
  fullScreen = false,
}: LogoLoaderProps) {
  const height = Math.round((size * VIEWBOX_H) / VIEWBOX_W);

  const loader = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-4 ${className}`}
    >
      <svg
        className="icf-loader text-[#142c50] [--icf-accent:#9c5722] dark:text-[#f5ede3] dark:[--icf-accent:#cfb390]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width={size}
        height={height}
        style={{ ['--icf-speed' as string]: `${speed}s` }}
        aria-hidden="true"
        focusable="false"
      >
        <polygon className="icf-part icf-navy icf-chevron-1" points="317.926 143.802 269.668 191.734 173.853 96.054 269.849 .215 317.905 48.261 269.78 95.937 317.926 143.802" />
        <polygon className="icf-part icf-clay icf-chevron-2" points="214.774 144.045 166.804 192.013 70.917 96.161 166.732 .408 214.435 48.158 166.067 95.957 214.774 144.045" />
        <polygon className="icf-part icf-navy icf-diamond" points="63.673 95.945 15.55 48.302 63.953 0 111.987 47.922 63.673 95.945" />
        <polygon className="icf-part icf-navy icf-diamond" points="64 192.413 15.788 144.338 64.241 96.38 112.212 144.254 64 192.413" />
        <polygon className="icf-part icf-navy icf-dot-l" points="15.396 111.396 0 95.87 15.743 80.413 31.53 95.682 15.396 111.396" />
        <polygon className="icf-part icf-navy icf-dot-r" points="317.908 111.52 302.658 96.25 318.444 81.043 333.469 96.394 317.908 111.52" />
      </svg>

      {showText ? (
        <span className="mt-3 text-xs font-semibold uppercase tracking-wider text-[#142c50]/80 dark:text-[#cfb390]">
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}

      <style>{css}</style>
    </div>
  );

  if (!fullScreen) return loader;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#fbf8f4]/90 backdrop-blur-sm dark:bg-[#0e1f3a]/90">
      {loader}
    </div>
  );
}

/*
Usage:

  // Full page / app start
  {isBooting && <LogoLoader fullScreen showText />}

  // Route-level Suspense fallback
  <Suspense fallback={<LogoLoader fullScreen />}>
    <Outlet />
  </Suspense>

  // Inline, smaller and slower
  <LogoLoader size={48} speed={1.4} />
*/