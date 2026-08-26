"use client";

import { useState } from "react";

/**
 * The one real "prove ownership" step SPEC §4.2 defines: an informal,
 * out-of-band DM an admin cross-references by hand — no generated
 * message, no ref code, no expiry timer. Exported so the onboarding gate
 * (apps/protocol/gate) can reuse this exact form/wiring for its own
 * "apply" stage rather than re-implementing the submit call.
 */
export function ApplicationForm({
  initialName,
  submitLabel,
  onSubmitted,
}: {
  initialName: string;
  submitLabel: string;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/protocol", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not submit. Try again.");
      return;
    }
    onSubmitted();
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[12.5px] text-ink-2">
        Protocol name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Finance"
          className="rounded-md border border-white/[.1] bg-void px-3 py-2.5 text-[13px] text-ink-1 outline-none focus:border-pulse-cyan/50"
        />
      </label>
      <p className="text-[11.5px] leading-[1.5] text-ink-4">
        We verify your protocol out-of-band — have your official account confirm this wallet address
        to EMP (e.g. via a DM on X). An admin cross-references that against this application.
      </p>
      <button
        onClick={submit}
        disabled={submitting || name.trim().length < 2}
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
