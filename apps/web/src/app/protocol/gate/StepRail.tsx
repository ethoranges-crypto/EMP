export interface GateStep {
  n: number;
  label: string;
  sub: string;
  state: "done" | "current" | "future";
}

/**
 * The design's 5-step rail assumed a "prove ownership via X DM with a
 * generated ref code" sub-flow that doesn't exist in this codebase — SPEC
 * §4.2's real verification is informal/out-of-band (an admin manually
 * cross-references a DM against the application, no ref code, no
 * expiry timer, nothing this UI generates or tracks). Rather than invent
 * that mechanism, this rail has 4 real steps: connect, sign in, apply,
 * admin review — matching what actually happens.
 */
export function StepRail({ steps, footnote }: { steps: GateStep[]; footnote: string }) {
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
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-pulse-amber font-mono text-[10px] font-bold text-pulse-amber">
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
                step.state === "current" ? "text-pulse-amber" : step.state === "future" ? "text-ink-4" : "text-ink-1"
              }`}
            >
              {step.label}
            </div>
            <div className={`font-mono text-[10.5px] leading-[1.4] ${step.state === "current" ? "text-[#8b8069]" : "text-ink-5"}`}>
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
