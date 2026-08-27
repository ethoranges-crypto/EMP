"use client";

import { useState } from "react";

/**
 * The one real "prove ownership" step SPEC §4.2 defines: an informal,
 * out-of-band DM an admin cross-references by hand — no generated
 * message, no ref code, no expiry timer. Name and X handle are what the
 * admin cross-references that DM against. Exported so the onboarding gate
 * (apps/protocol/gate) can reuse this exact form/wiring for its own
 * "apply" stage rather than re-implementing the submit call.
 */
export function ApplicationForm({
  initialName,
  initialXHandle,
  submitLabel,
  onSubmitted,
}: {
  initialName: string;
  initialXHandle: string;
  submitLabel: string;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [xHandle, setXHandle] = useState(initialXHandle);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/protocol", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, xHandle }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not submit. Try again.");
      return;
    }
    onSubmitted();
  }

  const canSubmit = name.trim().length >= 2 && xHandle.trim().replace(/^@+/, "").length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[12.5px] text-ink-2">
        Protocol name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ACME Corporation"
          className="rounded-md border border-white/[.1] bg-void px-3 py-2.5 text-[13px] text-ink-1 outline-none focus:border-pulse-cyan/50"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] text-ink-2">
        X handle
        <input
          type="text"
          value={xHandle}
          onChange={(e) => setXHandle(e.target.value)}
          placeholder="@acmecorp"
          className="rounded-md border border-white/[.1] bg-void px-3 py-2.5 text-[13px] text-ink-1 outline-none focus:border-pulse-cyan/50"
        />
      </label>
      <p className="text-[11.5px] leading-[1.5] text-ink-4">
        You will need to DM our X account confirming your sign in wallet from your official Protocol
        account in order to be verified.
      </p>
      <button
        onClick={submit}
        disabled={submitting || !canSubmit}
        className="self-start rounded-md bg-pulse-cyan px-5 py-2.5 text-[12.5px] font-semibold text-onaccent-cyan transition hover:shadow-glow disabled:opacity-50"
      >
        {submitting ? "Submitting…" : submitLabel}
      </button>
      {error && (
        <p role="alert" className="text-[12.5px] text-pulse-red">
          {error}
        </p>
      )}
    </div>
  );
}
