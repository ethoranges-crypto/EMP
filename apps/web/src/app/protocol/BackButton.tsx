"use client";

import Link from "next/link";

const CLASS_NAME = "flex items-center gap-1 text-[12.5px] text-ink-3 transition hover:text-ink-1";

/**
 * Every full-viewport sub-screen (composer, campaign view, dashboard) had
 * only a small ✕ in the far corner (or nothing at all) as its way back —
 * easy to miss, especially past several other header buttons. This is a
 * plain, labelled, always-leftmost control instead, right after the
 * wordmark on every one of those screens.
 *
 * Composer/CampaignView are client-state overlays (no route of their own),
 * so they close via `onClick`; the dashboard is a real route, so it
 * navigates back via `href` instead. Exactly one of the two is expected.
 */
export function BackButton({ onClick, href }: { onClick?: () => void; href?: string }) {
  if (href) {
    return (
      <Link href={href} className={CLASS_NAME}>
        <span aria-hidden="true">←</span> Back
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={CLASS_NAME}>
      <span aria-hidden="true">←</span> Back
    </button>
  );
}
