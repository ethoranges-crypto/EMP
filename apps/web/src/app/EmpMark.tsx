/**
 * The ringed-dot logo mark from the design handoff — a small filled circle
 * inside a cyan ring, reused wherever the wordmark appears (landing header,
 * every /user state's header). `shadow-glow` is the same boxShadow token
 * used everywhere else a cyan glow is needed, not a bespoke blur value.
 */
export function EmpMark({ size = 22 }: { size?: number }) {
  const dot = Math.round(size * 0.27);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-pulse-cyan shadow-glow"
      style={{ width: size, height: size }}
    >
      <div className="rounded-full bg-pulse-cyan" style={{ width: dot, height: dot }} />
    </div>
  );
}
