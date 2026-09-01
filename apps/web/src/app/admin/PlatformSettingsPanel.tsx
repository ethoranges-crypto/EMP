"use client";

import { useState } from "react";
import type { PlatformSettings } from "./types";

/**
 * SPEC §4.5/§6: the flat cost-per-user (USD) that campaign approval locks
 * a cost against. Until this is set, approving any campaign fails —
 * see the moderate route's "Platform cost settings are not configured".
 */
export function PlatformSettingsPanel({
  settings,
  onChange,
}: {
  settings: PlatformSettings;
  onChange: () => void;
}) {
  const [value, setValue] = useState(settings.flatCostPerUser ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    const parsed = Number(value);
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flatCostPerUser: parsed }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    onChange();
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Platform pricing</h2>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Flat cost per user (USD)
        <div className="flex items-center gap-2">
          <span className="text-slate-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="0.50"
            className="w-32 rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-cyan/50"
          />
        </div>
      </label>
      <p className="text-xs text-slate-500">
        Charged per messageable user in a campaign&apos;s snapshot, locked at approval (SPEC §6). Paid in USDC or
        USDT — both USD-pegged 1:1, so this dollar figure is the token amount owed.
      </p>

      <button
        onClick={() => void save()}
        disabled={saving || value === ""}
        className="self-start rounded-full bg-pulse-cyan px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {saved && <p className="text-xs text-pulse-cyan">Saved.</p>}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
