"use client";

import { formatScheduledSendAt, localInputValueToIso, localTimeZoneName } from "../schedule";

/**
 * Not in the design's mockup at all — the CD handoff's compose screen has
 * no schedule concept and instead shows a CHAIN / PAY WITH / FROM row,
 * which belongs to the payment step (chosen only after moderation
 * approves, SPEC §6), not compose — so it doesn't apply here. Substituted
 * this in the space it left behind: existing send-now/schedule
 * functionality that has to live somewhere in the merged screen.
 */
export function ScheduleCard({
  sendMode,
  onSendModeChange,
  scheduledLocal,
  onScheduledLocalChange,
}: {
  sendMode: "immediate" | "scheduled";
  onSendModeChange: (mode: "immediate" | "scheduled") => void;
  scheduledLocal: string;
  onScheduledLocalChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-[10px] font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">03 · WHEN TO SEND</div>
      <div className="flex flex-col gap-[10px] rounded-card border border-white/[.1] bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSendModeChange("immediate")}
            className={`rounded-chip border px-4 py-[7px] text-[12.5px] transition ${
              sendMode === "immediate"
                ? "border-pulse-cyan/45 bg-pulse-cyan/10 text-pulse-cyan"
                : "border-white/[.14] text-ink-3 hover:border-white/25"
            }`}
          >
            As soon as payment clears
          </button>
          <button
            type="button"
            onClick={() => onSendModeChange("scheduled")}
            className={`rounded-chip border px-4 py-[7px] text-[12.5px] transition ${
              sendMode === "scheduled"
                ? "border-pulse-violet/45 bg-pulse-violet/10 text-pulse-violet"
                : "border-white/[.14] text-ink-3 hover:border-white/25"
            }`}
          >
            Schedule for later
          </button>
        </div>
        {sendMode === "scheduled" && (
          <div className="flex flex-col gap-1">
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={(e) => onScheduledLocalChange(e.target.value)}
              className="w-fit rounded-md border border-white/[.14] bg-void px-3 py-2 text-[12.5px] text-ink-1 outline-none focus:border-pulse-violet/50"
            />
            <span className="text-[11px] text-ink-5">
              Your local time — {localTimeZoneName()}. Sends once this time arrives, as long as payment has already
              cleared by then.
            </span>
            {scheduledLocal && (
              <span className="text-[11px] text-pulse-violet">Scheduled: {formatScheduledSendAt(localInputValueToIso(scheduledLocal))}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
