"use client";

import { useState } from "react";
import type { AdminCategory } from "./types";

function CategoryRow({ category, onChange }: { category: AdminCategory; onChange: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: { name?: string; active?: boolean }) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save.");
      return;
    }
    setRenaming(false);
    onChange();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-void/40 p-3">
      <div className="flex items-center justify-between gap-3">
        {renaming ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-void px-2 py-1 text-sm text-slate-100 outline-none focus:border-pulse-cyan/50"
          />
        ) : (
          <span className={"text-sm " + (category.active ? "text-slate-100" : "text-slate-500 line-through")}>
            {category.name}
          </span>
        )}

        <div className="flex shrink-0 gap-2">
          {renaming ? (
            <>
              <button
                onClick={() => void patch({ name })}
                disabled={busy || name.trim().length < 2}
                className="rounded-full bg-pulse-cyan px-3 py-1 text-xs font-medium text-void disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setRenaming(false);
                  setName(category.name);
                }}
                disabled={busy}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setRenaming(true)}
                disabled={busy}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100 hover:bg-white/20"
              >
                Rename
              </button>
              <button
                onClick={() => void patch({ active: !category.active })}
                disabled={busy}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100 hover:bg-white/20"
              >
                {category.active ? "Deactivate" : "Activate"}
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * SPEC §7: interest categories are admin-configured, not hardcoded.
 * Deactivating (not deleting) is the only way to retire one — past
 * campaigns/interests keep referencing it, it just stops being offered as
 * a choice going forward.
 */
export function CategoriesPanel({ categories, onChange }: { categories: AdminCategory[]; onChange: () => void }) {
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not create the category.");
      return;
    }
    setNewName("");
    onChange();
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Interest categories</h2>

      {categories.length === 0 && <p className="text-sm text-slate-500">No categories yet.</p>}
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} onChange={onChange} />
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-cyan/50"
        />
        <button
          onClick={() => void create()}
          disabled={submitting || newName.trim().length < 2}
          className="shrink-0 rounded-full bg-pulse-cyan px-4 py-2 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
