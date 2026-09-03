"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config/categories";
import { UserHeader } from "./UserHeader";
import { StepRow } from "./StepRow";
import { OnboardingFooter } from "./OnboardingFooter";
import type { UserMe } from "./types";

interface Category {
  id: string;
  name: string;
  selected: boolean;
}

/**
 * State 2 — interest multi-select. Kept the pulse-violet selected-state
 * (not the mockup's cyan) — it's the existing, already-approved distinction
 * from users picking their own interests vs. the cyan protocol side uses
 * for targeting the same category list, and the task explicitly asked to
 * keep it.
 *
 * Flagged deviation: dropped the mockup's "TYPICAL VOLUME · 2–5 MESSAGES
 * PER MONTH" line — nothing in this system computes a real per-user message
 * rate, and inventing one would be exactly the kind of fake stat CLAUDE.md
 * rules out elsewhere (no fabricated metrics).
 *
 * `mode: "onboarding"` (fresh account, first pass) advances to the next
 * step on save; `mode: "edit"` (reached from the home state's "edit" link)
 * returns to home instead — same PUT /api/user/interests either way.
 */
export function InterestsState({
  mode,
  onDone,
}: {
  mode: "onboarding" | "edit";
  onDone: () => void;
}) {
  const { address } = useAccount();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/interests")
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  /**
   * "Everything" is a real category row like any other (its own id, its own
   * UserInterest row when selected) and toggling it here is a plain
   * independent flip, same as any other chip — it writes exactly ONE
   * UserInterest row, not one per real category.
   *
   * This used to also flip every other chip's `selected` state, because the
   * query layer treated a user's own Everything pick as an inert tag: a
   * protocol targeting a specific category (e.g. Yields) would not match an
   * Everything-only user unless their UserInterest rows literally included
   * every category. That's no longer true — countMessageableUsers and
   * listMessageableChatIds (packages/core/src/protocolQueries) now expand a
   * user's Everything row to match any specific-category targeting at query
   * time, so writing 6 rows here to get the same effect became redundant
   * (and wasteful — 6x the rows for no behavioral gain). The dashed border +
   * "ALL {n}" badge below still communicates that selecting Everything
   * covers every category; it just does so as a single stored row now.
   */
  function toggle(id: string) {
    setCategories((prev) => prev?.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)) ?? null);
  }

  async function save() {
    if (!categories) return;
    setSaving(true);
    const categoryIds = categories.filter((c) => c.selected).map((c) => c.id);
    await fetch("/api/user/interests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryIds }),
    });
    setSaving(false);
    onDone();
  }

  const selectedCount = categories?.filter((c) => c.selected).length ?? 0;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <UserHeader connected wallet={address} />
      {mode === "onboarding" && <StepRow current="interests" />}

      <div className="flex flex-1 flex-col items-center justify-center gap-0 overflow-y-auto px-6 py-8">
        <span className="mb-5 font-mono text-[10px] uppercase tracking-[.24em] text-pulse-cyan">
          tune your frequency
        </span>
        <h2 className="text-center text-[38px] font-medium leading-none tracking-[-.025em]">
          What should we pulse you about?
        </h2>
        <p className="mt-3.5 max-w-[440px] text-center text-[15px] leading-[1.6] text-ink-3">
          Pick as many as you like. You&apos;ll only ever receive messages matching these — change them
          whenever.
        </p>

        {categories === null && <p className="mt-11 text-[12.5px] text-ink-4">Loading…</p>}
        {categories?.length === 0 && (
          <p className="mt-11 text-[12.5px] text-ink-4">No interest categories configured yet — check back soon.</p>
        )}

        {categories && categories.length > 0 && (
          <>
            <div className="mt-11 flex max-w-[700px] flex-wrap justify-center gap-3">
              {categories.map((c) => {
                const everything = c.name === EVERYTHING_CATEGORY_NAME;
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={`flex items-center gap-2.5 rounded-md border px-[22px] py-3.5 text-[15px] transition ${
                      c.selected
                        ? "border-pulse-violet bg-pulse-violet/[.12] text-ink-1"
                        : everything
                          ? "border-dashed border-pulse-violet/55 text-pulse-violet hover:bg-pulse-violet/10"
                          : "border-white/[.11] text-ink-3 hover:border-pulse-cyan/50 hover:text-ink-1"
                    }`}
                  >
                    {c.selected && <span className="text-[12px] text-pulse-violet">✓</span>}
                    {c.name}
                    {everything && (
                      <span className="font-mono text-[9.5px] tracking-[.1em] text-pulse-violet/70">ALL {categories.length}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => void save()}
              disabled={saving || selectedCount === 0}
              className="mt-11 w-[472px] rounded-md bg-pulse-cyan px-4 py-4 text-center text-[14.5px] font-semibold text-onaccent-cyan transition hover:shadow-glow disabled:opacity-50"
            >
              {saving ? "Saving…" : mode === "edit" ? "Save interests" : `Continue — ${selectedCount} selected`}
            </button>
          </>
        )}
      </div>

      {mode === "onboarding" ? (
        <OnboardingFooter left="step 2 of 3" right="categories are set by EMP · protocols target the same list" />
      ) : (
        <div className="flex h-[52px] shrink-0 items-center justify-center border-t border-white/[.07] px-10">
          <button onClick={onDone} className="font-mono text-[10.5px] text-ink-5 transition hover:text-ink-3">
            cancel
          </button>
        </div>
      )}
    </main>
  );
}
