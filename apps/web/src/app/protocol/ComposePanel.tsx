"use client";

import { useEffect, useState } from "react";
import type { CampaignCta, CampaignDetail } from "./types";

interface CtaDraft {
  label: string;
  targetUrl: string;
}

/**
 * SPEC §4.3 step 2 / §8: text, optional image, one or more CTAs — saved
 * onto the existing DRAFT campaign. Every CTA the protocol enters here
 * comes back wrapped in a /r/:token tracking link once saved; nothing
 * downstream (moderation, send) is built yet.
 */
export function ComposePanel({
  campaignId,
  onClose,
  onSaved,
}: {
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctas, setCtas] = useState<CtaDraft[]>([]);
  const [savedCtas, setSavedCtas] = useState<CampaignCta[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/protocol/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((data: CampaignDetail) => {
        setDetail(data);
        setBodyText(data.bodyText ?? "");
        setImageUrl(data.imageUrl ?? "");
        setCtas(data.ctas.map((c) => ({ label: c.label, targetUrl: c.targetUrl })));
        setSavedCtas(data.ctas);
      });
  }, [campaignId]);

  function updateCta(index: number, field: keyof CtaDraft, value: string) {
    setCtas((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addCta() {
    setCtas((prev) => [...prev, { label: "", targetUrl: "" }]);
  }

  function removeCta(index: number) {
    setCtas((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyText, imageUrl: imageUrl.trim() || null, ctas }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save.");
      return;
    }
    const data = (await res.json()) as { ctas: CampaignCta[] };
    setSavedCtas(data.ctas);
    onSaved();
  }

  if (!detail) {
    return (
      <section className="rounded-xl border border-white/10 bg-surface p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pulse-violet/40 bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Compose — {detail.categoryNames.join(", ") || "—"}
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-100">
          ✕
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Message text
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={4}
          className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Image URL (optional)
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
        />
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-300">CTAs</p>
        {ctas.map((cta, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={cta.label}
              onChange={(e) => updateCta(i, "label", e.target.value)}
              placeholder="Label (e.g. Claim)"
              className="w-32 rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
            />
            <input
              type="text"
              value={cta.targetUrl}
              onChange={(e) => updateCta(i, "targetUrl", e.target.value)}
              placeholder="https://…"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
            />
            <button
              onClick={() => removeCta(i)}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100 hover:bg-white/20"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={addCta}
          className="self-start rounded-full bg-white/10 px-4 py-1.5 text-sm text-slate-100 hover:bg-white/20"
        >
          + Add CTA
        </button>
      </div>

      <button
        onClick={() => void save()}
        disabled={saving}
        className="self-start rounded-full bg-pulse-violet px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save draft"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {savedCtas.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-void/40 p-3">
          <p className="text-xs text-slate-500">Tracking links (auto-wrapped, SPEC §8 — this is what gets sent):</p>
          {savedCtas.map((c) => (
            <p key={c.redirectUrl} className="break-all text-xs text-pulse-cyan">
              {c.label}: {c.redirectUrl}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
