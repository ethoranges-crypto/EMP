"use client";

import { useCallback, useEffect, useState } from "react";
import { PAYMENT_TOKENS, type PaymentToken } from "@emp/config/paymentTokens";
import { StepRail, type Step } from "../StepRail";
import { BackButton } from "../BackButton";
import { LiveRail } from "./LiveRail";
import { statusChipClass } from "../dashboard/statusStyle";
import { formatCountdown, formatScheduledSendAt, isoToLocalInputValue, localInputValueToIso, localTimeZoneName } from "../schedule";
import type { CampaignDetail, ProtocolMe } from "../types";

interface ChainOption {
  key: string;
  displayName: string;
}

const FAILURE_COPY: Record<string, string> = {
  UNDERPAID: "A payment arrived but was short of the amount owed.",
  WRONG_TOKEN: "A payment arrived in the wrong token.",
  LATE: "Payment not received before the window closed.",
  DUPLICATE: "That transaction was already used for a different payment.",
};

/**
 * The 1b "Pay to fire" screen (2c) — the locked amount and treasury
 * address dominate the middle column; verification state lives in the
 * right rail (LiveRail); an exception state (underpaid/wrong-token/
 * late/duplicate), when there is one, is a single stacked box under the
 * main panel — never more than one at a time, since only the *current*
 * payment attempt's status ever applies.
 *
 * Flagged deviations from the design (flag, don't fake):
 *  - Dropped "Pay from wallet" — the protocol sends the transfer itself,
 *    from its own wallet app; nothing in this codebase initiates an
 *    on-chain transfer on the protocol's behalf. Copy address is real
 *    and stays.
 *  - Dropped the design's per-exception action set ("Send difference" /
 *    "Refund" / "Re-snapshot" / "Contact support") — none of those exist
 *    server-side. Kept this system's actual recovery actions (Retry,
 *    which reverts to APPROVED for a fresh chain/token pick, and Cancel)
 *    for every failure state, same as before this restyle.
 *  - Dropped the footnote's "detected and refunded" claim — there is no
 *    refund mechanism anywhere in this codebase (CLAUDE.md: no refunds).
 *    A duplicate is detected and blocked, not refunded.
 *  - See LiveRail's own comment for the dropped confirmation-count
 *    timeline (apps/worker's watcher doesn't track one).
 */
export function PaymentScreen({
  campaignId,
  onClose,
  onSaved,
}: {
  campaignId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [me, setMe] = useState<ProtocolMe | null>(null);
  const [chains, setChains] = useState<ChainOption[] | null>(null);
  const [chainsError, setChainsError] = useState<string | null>(null);
  const [chain, setChain] = useState("");
  const [token, setToken] = useState<PaymentToken>("USDC");
  const [saving, setSaving] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleLocal, setRescheduleLocal] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/protocol/campaigns/${campaignId}`);
    if (!res.ok) return;
    const data = (await res.json()) as CampaignDetail;
    setDetail(data);
    if (data.chain) setChain(data.chain);
    if (data.token) setToken(data.token);
    setRescheduleLocal(data.scheduledSendAt ? isoToLocalInputValue(data.scheduledSendAt) : "");
  }, [campaignId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetch("/api/protocol")
      .then((res) => (res.ok ? res.json() : null))
      .then((data?: ProtocolMe | null) => setMe(data ?? null))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    fetch("/api/protocol/chains")
      .then((r) => r.json())
      .then((data: { chains?: ChainOption[]; error?: string }) => {
        if (!data.chains) {
          setChainsError(data.error ?? "Could not load payment chains.");
          return;
        }
        setChains(data.chains);
        setChain((prev) => prev || data.chains![0]?.key || "");
      })
      .catch(() => setChainsError("Could not load payment chains."));
  }, []);

  // Once the payment window is open and still awaiting, poll for the
  // automated watcher's verdict — no read receipts / push here, same
  // "poll while pending" pattern as the protocol-application status. Also
  // poll while SCHEDULED so this screen picks up the worker's due-scan
  // firing the send live, instead of only ever refreshing on a manual
  // reschedule/cancel action.
  useEffect(() => {
    const awaitingVerdict = detail?.status === "AWAITING_PAYMENT" && detail.payment?.status === "AWAITING";
    if (!awaitingVerdict && detail?.status !== "SCHEDULED") return;
    const id = setInterval(() => void fetchDetail(), 5000);
    return () => clearInterval(id);
  }, [detail?.status, detail?.payment?.status, fetchDetail]);

  useEffect(() => {
    if (detail?.status === "SENDING" || detail?.status === "COMPLETE") {
      onSaved("Payment verified — sending started.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.status]);

  // Ticks the live countdown to the payment window's expiry.
  useEffect(() => {
    if (detail?.payment?.status !== "AWAITING") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [detail?.payment?.status]);

  async function saveReschedule(scheduledSendAt: string | null) {
    setRescheduling(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledSendAt }),
    });
    setRescheduling(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not update the schedule.");
      return;
    }
    void fetchDetail();
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/payment-method`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain, token }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save payment method.");
      return;
    }
    void fetchDetail();
  }

  async function recover(action: "retry-payment" | "cancel-payment") {
    setRecovering(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/${action}`, { method: "POST" });
    setRecovering(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not update this campaign.");
      return;
    }
    if (action === "cancel-payment") {
      onSaved("Campaign cancelled.");
      return;
    }
    void fetchDetail();
  }

  // Only reachable while APPROVED and no chain/token has been picked yet
  // (nothing paid) — cancelCampaign() enforces this same gate server-side
  // regardless of what this button is shown for. Once a payment window is
  // open, the exception-state Cancel above (recover("cancel-payment")) is
  // the only way out, and only after that attempt has already failed.
  async function cancelBeforePayment() {
    setCancelling(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/cancel`, { method: "POST" });
    setCancelling(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not cancel this campaign.");
      return;
    }
    onSaved("Campaign cancelled.");
  }

  if (!detail) {
    return (
      <main className="flex h-screen items-center justify-center bg-void">
        <p className="text-sm text-ink-4">Loading…</p>
      </main>
    );
  }

  const usd = detail.costAmount !== null ? Number(detail.costAmount) : null;
  const perUser = usd !== null && detail.snapshotCount ? usd / detail.snapshotCount : null;
  const failed =
    detail.payment && detail.payment.status !== "AWAITING" && detail.payment.status !== "VERIFIED" ? detail.payment.status : null;
  const msLeft = detail.payment ? new Date(detail.payment.windowExpiresAt).getTime() - now : null;

  const steps: Step[] = [
    { n: 1, label: "Target", sub: "categories locked", state: "done" },
    { n: 2, label: "Compose", sub: "locked for send", state: "done" },
    { n: 3, label: "Moderation", sub: detail.approvedAt ? `approved ${new Date(detail.approvedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : "approved", state: "done" },
    {
      n: 4,
      label: "Pay",
      sub: detail.payment ? `${detail.payment.amount} ${detail.payment.token}\n${detail.payment.chain}` : "pick chain + token",
      state: detail.status === "SCHEDULED" || detail.status === "SENDING" || detail.status === "COMPLETE" ? "done" : "current",
    },
    { n: 5, label: "Send", sub: detail.status === "SCHEDULED" ? "queued on schedule" : "queued on verify", state: detail.status === "SENDING" || detail.status === "COMPLETE" ? "done" : "future" },
  ];

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <header className="flex h-[57px] shrink-0 items-center gap-4 border-b border-white/[.07] px-[26px]">
        <div className="font-mono text-[13px] font-bold tracking-[.06em]">EMP</div>
        <BackButton onClick={onClose} />
        <div className="h-4 w-px bg-white/[.12]" />
        <div className="min-w-0 max-w-[280px] flex-1 truncate text-[13px] text-ink-2">{detail.title}</div>
        <span className={`whitespace-nowrap rounded-chip px-2.5 py-1 font-mono text-[10.5px] font-medium ${statusChipClass(detail.status)}`}>
          {detail.status.replace("_", " ")}
        </span>
        {detail.payment?.status === "AWAITING" && msLeft !== null && (
          <div className="ml-auto whitespace-nowrap font-mono text-[10.5px] text-pulse-amber">
            WINDOW CLOSES IN {formatCountdown(msLeft)}
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr_320px]">
        <StepRail steps={steps} accent="amber" footnote="Payment gates sending. Nothing leaves the queue until the chain confirms." />

        <div className="flex min-h-0 min-w-0 flex-col gap-[15px] overflow-y-auto px-[26px] py-6">
          <div className="flex flex-col gap-[6px]">
            <div className="text-[22px] font-semibold leading-[1.15] tracking-[-.01em]">Pay to fire</div>
            <div className="max-w-[540px] text-[12.5px] text-ink-4">
              Send the exact amount from the wallet you signed in with — that&apos;s how we match the payment to
              this campaign. One treasury address per chain.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-card border border-pulse-amber/30 bg-pulse-amber/5 p-[18px]">
            <div className="flex flex-col gap-[7px]">
              <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-[#8b8069]">EXACT AMOUNT</div>
              <div className="font-mono text-[34px] font-medium leading-none text-pulse-amber">
                {usd !== null ? usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
              </div>
              <div className="font-mono text-[11.5px] text-[#8b8069]">
                {detail.payment?.token ?? "USDC/USDT"}
                {detail.snapshotCount !== null && perUser !== null && ` · ${detail.snapshotCount.toLocaleString()} users × $${perUser.toFixed(2)}`}
                {" · locked at approval"}
              </div>
            </div>

            {detail.payment ? (
              <div className="flex flex-col gap-[7px]">
                <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-[#8b8069]">
                  EMP TREASURY · {detail.payment.chain.toUpperCase()}
                </div>
                <div className="break-all rounded-md border border-white/[.1] bg-void px-3 py-[11px] font-mono text-[12px]">
                  {detail.payment.treasuryAddress ?? "Treasury address unavailable — contact EMP."}
                </div>
                {detail.payment.treasuryAddress && (
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(detail.payment!.treasuryAddress!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="self-start rounded-md bg-pulse-amber px-[13px] py-2 text-[12px] font-semibold text-onaccent-amber"
                  >
                    {copied ? "Copied" : "Copy address"}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-[7px]">
                <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-[#8b8069]">CHOOSE HOW TO PAY</div>
                {chainsError && <p className="text-[12px] text-pulse-red">{chainsError}</p>}
                {!chainsError && chains === null && <p className="text-[12px] text-ink-4">Loading chains…</p>}
                {!chainsError && chains && chains.length === 0 && (
                  <p className="text-[12px] text-ink-4">No payment chain is configured yet — check back soon.</p>
                )}
                {chains && chains.length > 0 && (
                  <>
                    <select
                      value={chain}
                      onChange={(e) => setChain(e.target.value)}
                      className="rounded-md border border-white/[.1] bg-void px-3 py-2 text-[12.5px] text-ink-1"
                    >
                      {chains.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.displayName}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      {PAYMENT_TOKENS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setToken(t)}
                          className={`rounded-chip border px-4 py-1.5 text-[12.5px] transition ${
                            token === t
                              ? "border-pulse-amber/50 bg-pulse-amber/15 text-pulse-amber"
                              : "border-white/[.14] text-ink-3 hover:border-white/25"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void save()}
                        disabled={saving || !chain}
                        className="rounded-md bg-pulse-amber px-[13px] py-2 text-[12px] font-semibold text-onaccent-amber disabled:opacity-50"
                      >
                        {saving ? "Opening…" : "Show payment details"}
                      </button>
                      {detail.status === "APPROVED" && !confirmingCancel && (
                        <button
                          onClick={() => setConfirmingCancel(true)}
                          className="rounded-md border border-white/[.14] px-[13px] py-2 text-[12px] text-ink-3 transition hover:border-pulse-red/50 hover:text-pulse-red"
                        >
                          Cancel campaign
                        </button>
                      )}
                      {detail.status === "APPROVED" && confirmingCancel && (
                        <>
                          <span className="text-[11.5px] text-ink-4">Cancel for good?</span>
                          <button
                            onClick={() => void cancelBeforePayment()}
                            disabled={cancelling}
                            className="rounded-md bg-pulse-red px-[13px] py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                          >
                            {cancelling ? "Cancelling…" : "Yes, cancel"}
                          </button>
                          <button
                            onClick={() => setConfirmingCancel(false)}
                            className="rounded-md border border-white/[.14] px-[13px] py-2 text-[12px] text-ink-2 hover:border-white/25"
                          >
                            Never mind
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {detail.payment && (
            <div className="grid grid-cols-4 gap-[11px]">
              <div className="rounded-card border border-white/[.08] bg-surface p-[13px_14px]">
                <div className="mb-[7px] font-mono text-[10.5px] text-ink-5">CHAIN</div>
                <div className="text-[13px]">{detail.payment.chain}</div>
              </div>
              <div className="rounded-card border border-white/[.08] bg-surface p-[13px_14px]">
                <div className="mb-[7px] font-mono text-[10.5px] text-ink-5">TOKEN</div>
                <div className="text-[13px]">{detail.payment.token}</div>
              </div>
              <div className="rounded-card border border-white/[.08] bg-surface p-[13px_14px]">
                <div className="mb-[7px] font-mono text-[10.5px] text-ink-5">MUST SEND FROM</div>
                <div className="truncate font-mono text-[12px]">{me ? me.wallet : "—"}</div>
              </div>
              <div className="rounded-card border border-white/[.08] bg-surface p-[13px_14px]">
                <div className="mb-[7px] font-mono text-[10.5px] text-ink-5">WINDOW</div>
                <div className={`text-[13px] ${detail.payment.status === "AWAITING" ? "text-pulse-amber" : "text-ink-3"}`}>
                  {detail.payment.status === "AWAITING" && msLeft !== null ? `${formatCountdown(msLeft)} left` : "closed"}
                </div>
              </div>
            </div>
          )}

          {failed && (
            <div className="flex flex-col gap-[9px]">
              <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">EXCEPTION</div>
              <div className="flex items-center gap-3 rounded-card border border-pulse-red/35 bg-pulse-red/5 p-[13px_15px]">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-red" />
                <div className="text-[12.5px] text-ink-2">{FAILURE_COPY[failed] ?? "This payment attempt didn't go through."}</div>
                <div className="ml-auto flex shrink-0 gap-2">
                  <button
                    onClick={() => void recover("retry-payment")}
                    disabled={recovering}
                    className="whitespace-nowrap rounded-md bg-pulse-red px-[13px] py-[7px] text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    {recovering ? "Working…" : "Retry"}
                  </button>
                  <button
                    onClick={() => void recover("cancel-payment")}
                    disabled={recovering}
                    className="whitespace-nowrap rounded-md border border-white/[.14] px-[13px] py-[7px] text-[12px] text-ink-2 hover:border-white/25 disabled:opacity-50"
                  >
                    Cancel campaign
                  </button>
                </div>
              </div>
            </div>
          )}

          {detail.status === "SCHEDULED" && (
            <div className="flex flex-col gap-[10px]">
              <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">SEND TIME</div>
              <div className="flex flex-col gap-[10px] rounded-card border border-pulse-violet/30 bg-pulse-violet/5 p-4">
                {detail.scheduledSendAt ? (
                  <p className="text-[12.5px] text-pulse-violet">Scheduled for {formatScheduledSendAt(detail.scheduledSendAt)}</p>
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
                    {rescheduling ? "Saving…" : detail.scheduledSendAt ? "Save new time" : "Schedule send"}
                  </button>
                  {detail.scheduledSendAt && (
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
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-[12.5px] text-pulse-red">
              {error}
            </p>
          )}

          <div className="mt-auto flex items-center gap-3 rounded-card border border-white/[.08] p-[13px_16px]">
            <div className="w-[96px] shrink-0 font-mono text-[9.5px] font-medium leading-[1.5] tracking-[.12em] text-ink-5">
              PRIVACY
              <br />
              BOUNDARY
            </div>
            <div className="text-[12.5px] text-ink-2">
              You&apos;re paying against a count of {detail.snapshotCount?.toLocaleString() ?? "—"} snapshotted
              recipients. EMP holds that list; it is never exposed to you, in this UI or any API response.
            </div>
          </div>
        </div>

        <LiveRail
          paymentStatus={detail.payment?.status ?? null}
          chain={detail.payment?.chain ?? (chain || null)}
          approvedAt={detail.approvedAt}
          snapshotCount={detail.snapshotCount}
        />
      </div>
    </main>
  );
}
