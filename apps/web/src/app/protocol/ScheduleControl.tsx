"use client";

import { useEffect, useState } from "react";
import { formatScheduledSendAt, isoToLocalInputValue, localInputValueToIso, localTimeZoneName } from "./schedule";

/**
 * Editing a SCHEDULED campaign's send time — already paid, so this is a
 * plain field update (rescheduleCampaign.ts), never a new payment. Shared
 * by CampaignView (the normal way a paid campaign is reached, per the
 * paid-campaign routing fix) and PaymentScreen (the in-session case where a
 * protocol is already watching an AWAITING_PAYMENT campaign when the
 * worker verifies payment and flips it straight to SCHEDULED — that
 * screen stays open rather than bouncing away, so it needs this control
 * too). One place this logic exists rather than two copies that could
 * drift.
 */
export function ScheduleControl({
  campaignId,
  scheduledSendAt,
  onUpdated,
}: {
  campaignId: string;
  scheduledSendAt: string | null;
  onUpdated: () => void;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleLocal, setRescheduleLocal] = useState(scheduledSendAt ? isoToLocalInputValue(scheduledSendAt) : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRescheduleLocal(scheduledSendAt ? isoToLocalInputValue(scheduledSendAt) : "");
  }, [scheduledSendAt]);

  async function saveReschedule(next: string | null) {
    setRescheduling(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledSendAt: next }),
    });
    setRescheduling(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not update the schedule.");
      return;
    }
    onUpdated();
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">SEND TIME</div>
      <div className="flex flex-col gap-[10px] rounded-card border border-pulse-violet/30 bg-pulse-violet/5 p-4">
        {scheduledSendAt ? (
          <p className="text-[12.5px] text-pulse-violet">Scheduled for {formatScheduledSendAt(scheduledSendAt)}</p>
        ) : (
          <p className="text-[12.5px] text-ink-3">No send time set — pick one below.</p>
        )}
        <div className="flex flex-col gap-1">
          <input
            type="datetime-local"
            value={rescheduleLocal}
            onChange={(e) => setRescheduleLocal(e.target.value)}
            className="w-fit rounded-md border border-white/[.14] bg-void px-3 py-2 text-[12.5px] text-ink-1 outline-none focus:border-pulse-violet/50"
          />
          <span className="text-[11px] text-ink-5">Your local time — {localTimeZoneName()}.</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => rescheduleLocal && void saveReschedule(localInputValueToIso(rescheduleLocal))}
            disabled={rescheduling || !rescheduleLocal}
            className="rounded-md bg-pulse-violet px-4 py-[7px] text-[12px] font-semibold text-void disabled:opacity-50"
          >
            {rescheduling ? "Saving…" : scheduledSendAt ? "Save new time" : "Schedule send"}
          </button>
          {scheduledSendAt && (
            <button
              onClick={() => void saveReschedule(null)}
              disabled={rescheduling}
              className="rounded-md border border-white/[.14] px-4 py-[7px] text-[12px] text-ink-2 hover:border-white/25 disabled:opacity-50"
            >
              Cancel scheduled send
            </button>
          )}
        </div>
        <p className="text-[11px] text-ink-5">Already paid — changing or cancelling the send time never requires paying again.</p>
        {error && (
          <p role="alert" className="text-[12px] text-pulse-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
