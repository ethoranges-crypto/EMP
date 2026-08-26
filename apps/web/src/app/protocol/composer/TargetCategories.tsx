"use client";

import type { Category } from "../types";

/**
 * Toggleable before a draft exists; locked (read-only) once one does —
 * createDraftCampaign sets a campaign's categories exactly once, at
 * creation (packages/core/src/campaigns/createCampaign.ts), and there is
 * no update-categories endpoint. That was already true in the old
 * two-screen flow (NewCampaignPanel picked categories, and the Compose
 * screen you moved to afterward had no way to touch them) — merging both
 * into one screen just makes the lock visible instead of implied by which
 * screen you were on.
 */
export function TargetCategories({
  categories,
  selectedIds,
  locked,
  onToggle,
}: {
  categories: Category[] | null;
  selectedIds: Set<string>;
  locked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-[10px] font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">01 · TARGET CATEGORIES</div>
      {categories === null && <p className="text-[12.5px] text-ink-4">Loading categories…</p>}
      {categories && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = selectedIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={locked}
                onClick={() => onToggle(c.id)}
                className={`rounded-chip px-[13px] py-[7px] text-[12.5px] transition ${
                  selected
                    ? "border border-pulse-cyan/45 bg-pulse-cyan/10 text-pulse-cyan"
                    : "border border-white/[.14] text-ink-3 hover:border-white/25"
                } ${locked ? "cursor-default" : "cursor-pointer"}`}
                style={{ borderRadius: "20px" }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}
      {locked && <p className="mt-2 text-[11px] text-ink-5">Categories cannot be changed once draft is saved.</p>}
    </div>
  );
}
