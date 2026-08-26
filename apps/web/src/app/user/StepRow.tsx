export type UserStep = "wallet" | "interests" | "telegram";

const STEPS: { key: UserStep; label: string }[] = [
  { key: "wallet", label: "Wallet" },
  { key: "interests", label: "Interests" },
  { key: "telegram", label: "Telegram" },
];

/**
 * The onboarding progress row from the design handoff — horizontal, not
 * protocol's vertical StepRail (different shape entirely, so this is its
 * own small component rather than a forced reuse). Only rendered for the
 * three onboarding states; the messageable/paused "home" states don't show
 * it, same as the design.
 */
export function StepRow({ current }: { current: UserStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex h-[62px] shrink-0 items-center gap-3.5 border-b border-white/[.05] px-10">
      {STEPS.map((step, i) => (
        <div key={step.key} className="contents">
          <div
            className={`flex items-center gap-2.5 rounded-md border px-3.5 py-[7px] ${
              i < idx
                ? "border-pulse-green/35 bg-pulse-green/5"
                : i === idx
                  ? "border-pulse-cyan/45 bg-pulse-cyan/10"
                  : "border-white/[.08]"
            }`}
          >
            <span
              className={`font-mono text-[10px] ${i < idx ? "text-pulse-green" : i === idx ? "text-pulse-cyan" : "text-ink-5"}`}
            >
              {i < idx ? "✓" : String(i + 1).padStart(2, "0")}
            </span>
            <span className={`text-[12.5px] ${i <= idx ? "text-ink-1" : "text-ink-5"}`}>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < idx ? "bg-pulse-green/25" : "bg-white/[.09]"}`} />}
        </div>
      ))}
    </div>
  );
}
