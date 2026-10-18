/** Shown by the static HTML until the workbench chunk has arrived; plain markup, no JavaScript needed. */
export default function Splash({step = 'Loading workbench'}) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-mark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d9d9de" strokeWidth="1.6">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 4v3M15 4v3M9 17v3M15 17v3M4 9h3M4 15h3M17 9h3M17 15h3" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </div>
      <div className="splash-name">Circuit Lab</div>
      <div className="splash-bar" />
      <div className="splash-step">{step}</div>
    </div>
  );
}
