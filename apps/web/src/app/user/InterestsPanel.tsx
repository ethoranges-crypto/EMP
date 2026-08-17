"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  selected: boolean;
}

export function InterestsPanel() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user/interests")
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  function toggle(id: string) {
    setSaved(false);
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
    setSaved(true);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Interests</h2>

      {categories === null && <p className="text-sm text-slate-500">Loading…</p>}
      {categories?.length === 0 && (
        <p className="text-sm text-slate-500">No interest categories configured yet — check back soon.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {categories?.map((c) => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={
              "rounded-full border px-4 py-1.5 text-sm transition " +
              (c.selected
                ? "border-pulse-violet bg-pulse-violet/10 text-pulse-violet"
                : "border-white/10 text-slate-400 hover:border-white/30")
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      {categories && categories.length > 0 && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 self-start rounded-full bg-white/10 px-5 py-1.5 text-sm text-slate-100 transition hover:bg-white/20 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save interests"}
        </button>
      )}
    </section>
  );
}
