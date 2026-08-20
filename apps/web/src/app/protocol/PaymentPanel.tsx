"use client";

import { useCallback, useEffect, useState } from "react";
import { PAYMENT_TOKENS, type PaymentToken } from "@emp/config/paymentTokens";
import type { CampaignDetail } from "./types";

interface ChainOption {
  key: string;
  displayName: string;
}

/**
 * SPEC §6: the payment step. Shown for an APPROVED campaign (still picking
 * a chain/token) or an AWAITING_PAYMENT one (window already open) — cost is
 * already locked (CLAUDE.md rule 3) as a plain USD amount, so this is
 * framed as paying EMP's bill, not as anything about campaign content (that
 * choice already happened, back at compose).
 *
 * Once a chain/token is picked, EMP opens the payment window immediately
 * (no separate "confirm" step) and this panel switches to showing exactly
 * where to send it: the treasury address, amount, and token. From there
 * it's fully automated (CLAUDE.md Payments / this turn's explicit
 * instruction) — apps/worker's on-chain watcher detects the transfer and
 * verifies it; this panel just polls the campaign's own status and closes
 * itself once verified. There is no manual "paste tx hash, admin verifies"
 * step in this flow.
 */
export function PaymentPanel({
  campaignId,
  onClose,
  onSaved,
}: {
  campaignId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [chains, setChains] = useState<ChainOption[] | null>(null);
  const [chainsError, setChainsError] = useState<string | null>(null);
  const [chain, setChain] = useState("");
  const [token, setToken] = useState<PaymentToken>("USDC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/protocol/campaigns/${campaignId}`);
    if (!res.ok) return;
    const data = (await res.json()) as CampaignDetail;
    setDetail(data);
    if (data.chain) setChain(data.chain);
    if (data.token) setToken(data.token);
  }, [campaignId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

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
  // "poll while pending" pattern as the protocol-application status.
  useEffect(() => {
    if (detail?.status !== "AWAITING_PAYMENT" || detail.payment?.status !== "AWAITING") return;
    const id = setInterval(() => void fetchDetail(), 5000);
    return () => clearInterval(id);
  }, [detail?.status, detail?.payment?.status, fetchDetail]);

  useEffect(() => {
    if (detail?.status === "SENDING" || detail?.status === "COMPLETE") {
      onSaved("Payment verified — sending started.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.status]);

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

  if (!detail) {
    return (
      <section className="rounded-xl border border-white/10 bg-surface p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </section>
    );
  }

  const usd = detail.costAmount !== null ? Number(detail.costAmount) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pulse-cyan/40 bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Pay EMP — {detail.title}</h2>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-100">
          ✕
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-void/40 px-4 py-3 text-center">
        {usd !== null && detail.snapshotCount !== null ? (
          <p className="text-lg font-semibold text-pulse-cyan">
            ${usd.toFixed(2)} to reach {detail.snapshotCount} user{detail.snapshotCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Cost not available.</p>
        )}
        <p className="mt-1 text-xs text-slate-500">This is what EMP charges to deliver this campaign — not part of its content.</p>
      </div>

      {detail.payment && (
        <div className="flex flex-col gap-3 rounded-lg border border-pulse-cyan/30 bg-void/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Send exactly</p>
          <p className="text-lg font-semibold text-slate-100">
            {detail.payment.amount} {detail.payment.token}
          </p>
          <p className="text-xs uppercase tracking-wide text-slate-500">On {detail.payment.chain}, to</p>
          <div className="flex items-center gap-2">
            <code className="break-all rounded-md bg-void px-2 py-1 text-xs text-slate-200">
              {detail.payment.treasuryAddress ?? "Treasury address unavailable — contact EMP."}
            </code>
            {detail.payment.treasuryAddress && (
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(detail.payment!.treasuryAddress!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-white/20"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Pay from the wallet you&apos;re signed in with — EMP&apos;s watcher matches the sending address
            automatically. This updates on its own once your payment is detected on-chain (usually within a
            few minutes); no need to refresh or contact EMP.
          </p>
          {detail.payment.status === "AWAITING" && <p className="text-sm text-pulse-cyan">Waiting for payment…</p>}
          {detail.payment.status === "UNDERPAID" && (
            <p className="text-sm text-red-400">A payment arrived but was short of the amount owed.</p>
          )}
          {detail.payment.status === "WRONG_TOKEN" && (
            <p className="text-sm text-red-400">A payment arrived in the wrong token.</p>
          )}
          {detail.payment.status === "LATE" && (
            <p className="text-sm text-red-400">A payment arrived after the window closed.</p>
          )}
        </div>
      )}

      {!detail.payment && chainsError && <p className="text-sm text-red-400">{chainsError}</p>}
      {!detail.payment && !chainsError && chains === null && <p className="text-sm text-slate-500">Loading chains…</p>}
      {!detail.payment && !chainsError && chains && chains.length === 0 && (
        <p className="text-sm text-slate-500">No payment chain is configured yet — check back soon.</p>
      )}

      {!detail.payment && chains && chains.length > 0 && (
        <>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Pay on
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100"
            >
              {chains.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm text-slate-300">
            <span>Pay in</span>
            <div className="flex gap-2">
              {PAYMENT_TOKENS.map((t) => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${
                    token === t
                      ? "border-pulse-cyan/60 bg-pulse-cyan/20 text-slate-100"
                      : "border-white/10 bg-void text-slate-400 hover:border-white/20"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void save()}
            disabled={saving || !chain}
            className="self-start whitespace-nowrap rounded-full bg-pulse-cyan px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
          >
            {saving ? "Opening…" : "Show payment details"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
