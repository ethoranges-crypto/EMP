/**
 * The "1b Spike" mark, cyan variant, transcribed from the design handoff
 * (EMP_Logo_Directions — symbols `m-spike-cy` / `m-spike-tight-cy`). Two
 * baseline widths mirror the handoff's own two sizes: `tight` pulls the
 * baseline inward (and thickens the stroke slightly) so the mark survives
 * being cropped inside a circle or shown very small — used for headers,
 * favicons and any circular/icon context — while the wide baseline is for
 * standalone use with room to breathe. Stroke color is the `pulse-cyan`
 * token via `currentColor` so it stays in lockstep with the rest of the
 * design system rather than a hardcoded hex.
 */
export function EmpMark({ size = 22, tight = true }: { size?: number; tight?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="EMP"
      className="shrink-0 text-pulse-cyan"
      style={{ display: "block" }}
    >
      {tight ? (
        <g fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 38 H20" opacity={0.34} />
          <path d="M40 38 H53" opacity={0.34} />
          <path d="M20 38 L26.5 14 L33.5 50 L40 38" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 38 H20" opacity={0.34} />
          <path d="M40 38 H59" opacity={0.34} />
          <path d="M20 38 L26.5 13 L33.5 51 L40 38" />
        </g>
      )}
    </svg>
  );
}

/**
 * Mark + "EMP" wordmark, for the several headers that show nothing but a
 * bare "EMP" label — one place to keep icon+text in sync rather than each
 * header hand-rolling the pairing. Text styling is a prop (not fixed to the
 * handoff's own JetBrains-Mono-700/0.01em spec) because these headers
 * predate this mark and already carry their own established type size —
 * swapping the icon in is the ask, not restyling text nobody flagged.
 */
export function EmpLockup({
  markSize = 15,
  textClassName = "font-mono text-[13px] font-bold tracking-[.06em]",
}: {
  markSize?: number;
  textClassName?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <EmpMark size={markSize} />
      <span className={textClassName}>EMP</span>
    </div>
  );
}
