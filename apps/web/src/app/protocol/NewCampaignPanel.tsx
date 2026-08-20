"use client";

import { useEffect, useState } from "react";
import { CAMPAIGN_TITLE_MAX_LENGTH } from "@emp/config/campaignLimits";
import type { Category } from "./types";

/**
 * SPEC §4.3 step 1: pick target categories, see the messageable audience
 * count (aggregate-only — GET/POST here never touch a wallet or chat_id;
 * see /api/protocol/audience-count's own doc comment for the actual
 * privacy-boundary enforcement), then persist a DRAFT. Compose (step 2)
 * is the next stage. Deliberately no chain/token here — that's how the
 * protocol pays EMP, not what the campaign is about, so it's chosen later
 * at the payment step, once the campaign is APPROVED (SPEC §6).
 */
export function NewCampaignPanel({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/protocol/categories")
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  // Re-fetches on every toggle — an AbortController drops a stale response
  // that resolves after a more recent one (e.g. two rapid clicks), so the
  // displayed count always matches the current selection, not a race.
  useEffect(() => {
    if (selected.size === 0) {
      setAudienceCount(null);
      setCountLoading(false);
      return;
    }
    const controller = new AbortController();
    setCountLoading(true);
    fetch("/api/protocol/audience-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryIds: Array.from(selected) }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: { audienceCount: number }) => {
        setAudienceCount(data.audienceCount);
        setCountLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setAudienceCount(null);
        setCountLoading(false);
      });
    return () => controller.abort();
  }, [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/protocol/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, categoryIds: Array.from(selected) }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not create the campaign.");
      return;
    }
    setTitle("");
    setSelected(new Set());
    setAudienceCount(null);
    onCreated();
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">New campaign</h2>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Campaign title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
          placeholder="e.g. Yield Boost Launch"
          className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
        />
      </label>

      {categories === null && <p className="text-sm text-slate-500">Loading categories…</p>}

      {categories && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className={
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition " +
                (selected.has(c.id)
                  ? "border-pulse-violet/60 bg-pulse-violet/20 text-slate-100"
                  : "border-white/10 bg-void text-slate-400 hover:border-white/20")
              }
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="sr-only"
              />
              {c.name}
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">
        &ldquo;Everything&rdquo; targets every messageable user, regardless of other categories picked.
      </p>

      <div role="status" className="rounded-lg border border-white/10 bg-void/40 px-4 py-3 text-center">
        {selected.size === 0 && (
          <p className="text-sm text-slate-500">Select a category to see the audience size.</p>
        )}
        {selected.size > 0 && countLoading && <p className="text-sm text-slate-500">Counting…</p>}
        {selected.size > 0 && !countLoading && audienceCount !== null && (
          <p className="text-lg font-semibold text-pulse-cyan">
            {audienceCount} messageable user{audienceCount === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <button
        onClick={submit}
        disabled={submitting || selected.size === 0 || title.trim().length === 0}
        className="self-start rounded-full bg-pulse-violet px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create draft campaign"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
