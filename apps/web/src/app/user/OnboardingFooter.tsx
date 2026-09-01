/** The plain two-line footer bar shared by the three onboarding states (1-3). */
export function OnboardingFooter({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex h-[52px] shrink-0 items-center justify-between border-t border-white/[.07] px-10">
      <span className="font-mono text-[10px] tracking-[.12em] text-ink-5">{left}</span>
      <span className="font-mono text-[10px] tracking-[.12em] text-ink-5">{right}</span>
    </div>
  );
}
