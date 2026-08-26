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
    <section className="flex flex-col gap-3 rounded-card border border-white/[.1] bg-surface p-4">
      <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">INTERESTS</div>

      {categories === null && <p className="text-[12.5px] text-ink-4">Loading…</p>}
      {categories?.length === 0 && (
        <p className="text-[12.5px] text-ink-4">No interest categories configured yet — check back soon.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {categories?.map((c) => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={`rounded-chip px-[13px] py-[7px] text-[12.5px] transition ${
              c.selected
                ? "border border-pulse-violet/45 bg-pulse-violet/10 text-pulse-violet"
                : "border border-white/[.14] text-ink-3 hover:border-white/25"
            }`}
            style={{ borderRadius: "20px" }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {categories && categories.length > 0 && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-1 self-start rounded-md border border-white/[.14] px-5 py-2.5 text-[12.5px] text-ink-2 transition hover:border-white/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save interests"}
        </button>
      )}
    </section>
  );
}
