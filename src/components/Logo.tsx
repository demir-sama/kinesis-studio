/** Kinesis mark: a K whose upper arm is an ease-out-expo curve ending on a keyframe diamond. */
export function LogoMark({ size = 32, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`logo-mark ${animated ? "is-animated" : ""} ${className}`} aria-hidden="true">
      <rect x="1" y="1" width="62" height="62" rx="16" fill="var(--logo-bg, #16161d)" />
      <rect className="lm-stem" x="13" y="12" width="8" height="40" rx="3" fill="var(--bone)" />
      <path className="lm-curve" d="M21 37 C 31 37, 33 15, 47 14" fill="none" stroke="var(--ember)" strokeWidth="7" strokeLinecap="round" pathLength={100} />
      <path className="lm-leg" d="M28 38 L 45 51" fill="none" stroke="var(--bone)" strokeWidth="7" strokeLinecap="round" pathLength={100} />
      <rect className="lm-key" x="44" y="8" width="11" height="11" rx="2" transform="rotate(45 49.5 13.5)" fill="var(--ember)" />
      <circle className="lm-dot" cx="49" cy="52" r="3.2" fill="var(--amber)" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size * 0.62 }}>
      <LogoMark size={size} />
      <span className="wm-text">Kinesis<em>Studio</em></span>
    </span>
  );
}
