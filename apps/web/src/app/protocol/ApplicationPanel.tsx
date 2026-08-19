"use client";

import { useState } from "react";
import type { ProtocolMe } from "./types";

function ApplicationForm({
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
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Protocol name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Finance"
          className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
        />
      </label>
      <p className="text-xs text-slate-500">
        We verify your protocol out-of-band — have your official account confirm this wallet address
        to EMP (e.g. via a DM on X). An admin cross-references that against this application.
      </p>
      <button
        onClick={submit}
        disabled={submitting || name.trim().length < 2}
        className="self-start rounded-full bg-pulse-violet px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
      >
        {submitting ? "Submitting…" : submitLabel}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function ApplicationPanel({ me, onChange }: { me: ProtocolMe; onChange: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Application</h2>

      {me.status === "PENDING" && me.name === "" && (
        <ApplicationForm initialName="" submitLabel="Submit application" onSubmitted={onChange} />
      )}

      {me.status === "PENDING" && me.name !== "" && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-void/40 px-6 py-8 text-center">
          <span className="text-3xl" aria-hidden>
            ⏳
          </span>
          <p className="text-lg font-semibold text-slate-200">Application pending review</p>
          <p className="text-sm text-slate-400">
            &ldquo;{me.name}&rdquo; is waiting on an EMP admin to verify and approve it. This page updates on its
            own once that happens.
          </p>
        </div>
      )}

      {me.status === "REJECTED" && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-red-400">
            {me.approvalNotes || "Your application was rejected."}
          </p>
          <ApplicationForm initialName={me.name} submitLabel="Resubmit application" onSubmitted={onChange} />
        </div>
      )}

      {me.status === "APPROVED" && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-pulse-cyan/50 bg-pulse-cyan/10 px-6 py-8 text-center shadow-glow">
          <span className="text-3xl" aria-hidden>
            ✅
          </span>
          <p className="text-lg font-semibold text-pulse-cyan">&ldquo;{me.name}&rdquo; is approved</p>
          <p className="text-sm text-slate-300">Campaign creation is coming in the next build stage.</p>
        </div>
      )}

      {me.status === "SUSPENDED" && (
        <p role="alert" className="text-sm text-red-400">
          This protocol has been suspended. Contact EMP for details.
        </p>
      )}
    </section>
  );
}
