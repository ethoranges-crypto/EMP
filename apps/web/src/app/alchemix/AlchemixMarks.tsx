/**
 * PLACEHOLDER — not Alchemix's real brand assets. The Claude Design handoff
 * references actual logo files (./assets/AlchemixFullLogo_White.svg,
 * ./assets/AlchemixMark.svg) that were never supplied to this session, and
 * fabricating a guess at Alchemix's real logomark shape would risk
 * misrepresenting their brand rather than recreating it. These are
 * deliberately plain, generic text/geometric treatments so the page is
 * complete and reviewable now — swap in the real SVGs (drop them in
 * apps/web/public/alchemix/ and update the two call sites in page.tsx)
 * before this goes live under Alchemix's name.
 */
export function AlchemixWordmark({ height = 26 }: { height?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        height,
        lineHeight: `${height}px`,
        fontFamily: "Montserrat, Helvetica, Arial, sans-serif",
        fontWeight: 600,
        fontSize: height * 0.62,
        letterSpacing: ".02em",
        color: "#FFFFFF",
      }}
    >
      ALCHEMIX
    </span>
  );
}

export function AlchemixMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden>
      <circle cx="15" cy="15" r="14" stroke="#F5C09A" strokeWidth="1.4" />
      <path d="M15 6 L22 21 H8 Z" stroke="#F5C09A" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
