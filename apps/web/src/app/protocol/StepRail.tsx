export interface Step {
  n: number;
  label: string;
  sub: string;
  state: "done" | "current" | "future";
}

const ACCENT = {
  cyan: { ring: "border-pulse-cyan", text: "text-pulse-cyan", subText: "text-ink-5" },
  amber: { ring: "border-pulse-amber", text: "text-pulse-amber", subText: "text-[#8b8069]" },
} as const;

/**
 * Shared by the onboarding gate (2a, amber accent — matching its
 * "awaiting/pending" colour elsewhere) and the campaign composer (1b, cyan
 * accent — matching its primary-action colour). Both screens' rails have
 * the same shape: numbered circles, a connecting line, done/current/future
 * states — only the "current" step's colour differs, which is why this
 * takes an accent rather than being two near-duplicate components.
 */
export function StepRail({
  steps,
  footnote,
  accent = "cyan",
}: {
  steps: Step[];
  footnote: string;
  accent?: "cyan" | "amber";
}) {
  const { ring, text, subText } = ACCENT[accent];
  return (
    <div className="flex flex-col overflow-y-auto border-r border-white/[.07] bg-void px-[18px] py-6">
      {steps.map((step, i) => (
        <div key={step.n} className="flex gap-3">
          <div className="flex flex-col items-center">
            {step.state === "done" && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-pulse-cyan font-mono text-[10px] font-bold text-onaccent-cyan">
                ✓
              </div>
            )}
            {step.state === "current" && (
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${ring} font-mono text-[10px] font-bold ${text}`}>
                {step.n}
              </div>
            )}
            {step.state === "future" && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/[.18] font-mono text-[10px] font-bold text-ink-5">
                {step.n}
              </div>
            )}
            {i < steps.length - 1 && (
              <div className={`min-h-[40px] w-px flex-1 ${step.state === "done" ? "bg-pulse-cyan" : "bg-white/[.12]"}`} />
            )}
          </div>
          <div className="pb-6">
            <div
              className={`mb-[3px] font-medium ${
                step.state === "current" ? text : step.state === "future" ? "text-ink-4" : "text-ink-1"
              }`}
            >
              {step.label}
            </div>
            <div
              className={`whitespace-pre-line font-mono text-[10.5px] leading-[1.4] ${
                step.state === "current" ? subText : "text-ink-5"
              }`}
            >
              {step.sub}
            </div>
          </div>
        </div>
      ))}
      <div className="mt-auto rounded-lg border border-white/[.08] p-3 font-mono text-[10.5px] leading-[1.5] text-ink-5">
        {footnote}
      </div>
    </div>
  );
}
