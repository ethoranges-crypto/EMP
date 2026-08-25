"use client";

import { useEffect, useMemo, useState } from "react";
import { CAMPAIGN_TITLE_MAX_LENGTH } from "@emp/config/campaignLimits";
import { CTA_LABEL_MAX_LENGTH, telegramTextLimit } from "@emp/config/telegramLimits";
import { StepRail, type Step } from "../StepRail";
import { LiveRail } from "./LiveRail";
import { TargetCategories } from "./TargetCategories";
import { MessageCard } from "./MessageCard";
import { ScheduleCard } from "./ScheduleCard";
import { MessagePreview } from "../MessagePreview";
import { isoToLocalInputValue, localInputValueToIso } from "../schedule";
import type { Category, CampaignDetail } from "../types";

interface CtaDraft {
  label: string;
  targetUrl: string;
}

/**
 * The 1b "Pulse composer" — SPEC §4.3 steps 1+2 (target + compose) merged
 * into one screen, replacing the old NewCampaignPanel -> ComposePanel
 * two-step flow. The underlying endpoints are unchanged: POST
 * /api/protocol/campaigns still creates a DRAFT with its title+categories
 * locked in immediately (packages/core's createDraftCampaign has no way to
 * change them afterward — see TargetCategories's own comment), and PATCH
 * .../campaigns/:id still separately saves bodyText/ctas/schedule. This
 * screen just calls both from a single "Save draft" action: the first
 * save creates the draft (if one doesn't exist yet) *and* immediately
 * persists whatever's already been typed in the message/CTA fields, so
 * nothing composed before that first click is lost — see performSave.
 *
 * performSave/ensureDraftCreated thread the resolved campaignId through
 * their return values rather than reading the `campaignId` state variable
 * right after setting it — a state setter doesn't update the value a
 * still-running function closed over, so submitForApproval acting on a
 * brand-new draft would otherwise still see null and hit
 * /api/protocol/campaigns/null/submit.
 */
export function Composer({
  campaignId: initialCampaignId,
  onClose,
  onSaved,
}: {
  /** null = creating a new campaign; a string = resuming an existing DRAFT/REJECTED one. */
  campaignId: string | null;
  onClose: () => void;
  onSaved: (campaignId: string, message: string) => void;
}) {
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ctas, setCtas] = useState<CtaDraft[]>([]);
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [flatCostPerUser, setFlatCostPerUser] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const categoriesLocked = campaignId !== null;

  useEffect(() => {
    fetch("/api/protocol/categories")
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    fetch("/api/protocol/pricing")
      .then((res) => (res.ok ? res.json() : null))
      .then((data?: { flatCostPerUser: string | null } | null) => {
        if (!data) return;
        setFlatCostPerUser(data.flatCostPerUser !== null ? Number(data.flatCostPerUser) : null);
      })
      .catch(() => setFlatCostPerUser(null));
  }, []);

  // Loads an existing draft's full detail — campaignId is only ever set
  // from the initial prop here, or by ensureDraftCreated below; this
  // effect deliberately depends on the prop, not the state, so it never
  // re-fires against a campaign this screen just created itself.
  useEffect(() => {
    if (!initialCampaignId) return;
    fetch(`/api/protocol/campaigns/${initialCampaignId}`)
      .then((r) => r.json())
      .then((data: CampaignDetail) => {
        setDetail(data);
        setTitle(data.title);
        setBodyText(data.bodyText ?? "");
        setImagePreviewUrl(data.imageUrl);
        setCtas(data.ctas.map((c) => ({ label: c.label, targetUrl: c.targetUrl })));
        if (data.scheduledSendAt) {
          setSendMode("scheduled");
          setScheduledLocal(isoToLocalInputValue(data.scheduledSendAt));
        }
      });
  }, [initialCampaignId]);

  // Recovers an existing draft's categoryIds by joining its (name-only)
  // categoryNames against the categories list — GET .../campaigns/:id
  // never returns ids (see that route's own comment), and category names
  // are already treated as the taxonomy's stable identifier elsewhere
  // (EVERYTHING_CATEGORY_NAME lookups), so this join is safe.
  useEffect(() => {
    if (!detail || !categories) return;
    const ids = categories.filter((c) => detail.categoryNames.includes(c.name)).map((c) => c.id);
    setSelectedCategoryIds(new Set(ids));
  }, [detail, categories]);

  function toggleCategory(id: string) {
    if (categoriesLocked) return;
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Live audience count for whatever's currently targeted — re-fetches on
  // every toggle before a draft exists, and once (settling on the locked
  // set) after one does. An AbortController drops a stale response that
  // resolves after a more recent one.
  useEffect(() => {
    if (selectedCategoryIds.size === 0) {
      setAudienceCount(null);
      setCountLoading(false);
      return;
    }
    const controller = new AbortController();
    setCountLoading(true);
    fetch("/api/protocol/audience-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryIds: Array.from(selectedCategoryIds) }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data?: { audienceCount: number } | null) => {
        if (data && typeof data.audienceCount === "number") setAudienceCount(data.audienceCount);
        setCountLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setAudienceCount(null);
        setCountLoading(false);
      });
    return () => controller.abort();
  }, [selectedCategoryIds]);

  // Ticks the "saved Xs ago" label in the header.
  useEffect(() => {
    if (lastSavedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  const hasImage = imagePreviewUrl !== null;
  const textLimit = telegramTextLimit(hasImage);
  const textOverLimit = bodyText.length > textLimit;
  const hasComposedContent = bodyText.trim().length > 0;
  const scheduleIncomplete = sendMode === "scheduled" && scheduledLocal.trim().length === 0;
  const hasTitle = title.trim().length > 0;
  const hasCategories = categoriesLocked || selectedCategoryIds.size > 0;

  const canSave = useMemo(
    () =>
      hasTitle &&
      hasCategories &&
      !textOverLimit &&
      ctas.every((c) => c.label.length <= CTA_LABEL_MAX_LENGTH) &&
      !scheduleIncomplete,
    [hasTitle, hasCategories, textOverLimit, ctas, scheduleIncomplete],
  );
  const canSubmit = canSave && hasComposedContent;

  function updateCta(index: number, field: keyof CtaDraft, value: string) {
    setCtas((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function addCta() {
    setCtas((prev) => [...prev, { label: "", targetUrl: "" }]);
  }
  function removeCta(index: number) {
    setCtas((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadImage(file: File) {
    if (!campaignId) return;
    setImageError(null);
    setImageBusy(true);
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/image`, { method: "POST", body: formData });
    setImageBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setImageError(data.error ?? "Could not upload image.");
      return;
    }
    setImagePreviewUrl(`/api/protocol/campaigns/${campaignId}/image?t=${Date.now()}`);
  }

  async function removeImage() {
    if (!campaignId) return;
    setImageBusy(true);
    setImageError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/image`, { method: "DELETE" });
    setImageBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setImageError(data.error ?? "Could not remove image.");
      return;
    }
    setImagePreviewUrl(null);
  }

  /** Creates the draft (title + locked categories) the first time this is called; a no-op after that. */
  async function ensureDraftCreated(): Promise<string | null> {
    if (campaignId) return campaignId;
    const res = await fetch("/api/protocol/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, categoryIds: Array.from(selectedCategoryIds) }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not create the draft.");
      return null;
    }
    const data = (await res.json()) as { campaignId: string };
    setCampaignId(data.campaignId);
    return data.campaignId;
  }

  /** Returns the campaign's id on success (freshly created or already existing) — never the stale `campaignId` state. */
  async function performSave(): Promise<string | null> {
    setSaving(true);
    setError(null);
    const id = await ensureDraftCreated();
    if (!id) {
      setSaving(false);
      return null;
    }
    const scheduledSendAt = sendMode === "scheduled" && scheduledLocal ? localInputValueToIso(scheduledLocal) : null;
    const res = await fetch(`/api/protocol/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyText, ctas, scheduledSendAt }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save.");
      return null;
    }
    setLastSavedAt(Date.now());
    setNow(Date.now());
    return id;
  }

  async function save() {
    const id = await performSave();
    if (id) onSaved(id, "Draft saved.");
  }

  async function submitForApproval() {
    const id = await performSave();
    if (!id) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${id}/submit`, { method: "POST" });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not submit for approval.");
      return;
    }
    onSaved(id, "Submitted for review.");
  }

  const savedSecondsAgo = lastSavedAt !== null ? Math.max(0, Math.round((now - lastSavedAt) / 1000)) : null;

  const steps: Step[] = [
    {
      n: 1,
      label: "Target",
      sub: categoriesLocked
        ? `${selectedCategoryIds.size} categor${selectedCategoryIds.size === 1 ? "y" : "ies"}\n${
            typeof audienceCount === "number" ? audienceCount.toLocaleString() : "—"
          } messageable`
        : selectedCategoryIds.size > 0
          ? `${selectedCategoryIds.size} selected`
          : "not chosen yet",
      state: categoriesLocked ? "done" : "current",
    },
    {
      n: 2,
      label: "Compose",
      sub:
        hasComposedContent || hasImage || ctas.length > 0
          ? `${hasImage ? "text + image" : "text"}\n${ctas.length} CTA${ctas.length === 1 ? "" : "s"}`
          : "not started",
      state: categoriesLocked ? "current" : "future",
    },
    { n: 3, label: "Moderation", sub: "EMP reviews\nmanually, by hand", state: "future" },
    { n: 4, label: "Pay", sub: "locked at\nsnapshot", state: "future" },
    { n: 5, label: "Send", sub: "queued burst", state: "future" },
  ];

  if (initialCampaignId && !detail) {
    return (
      <main className="flex h-screen items-center justify-center bg-void">
        <p className="text-sm text-ink-4">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <header className="flex h-[57px] shrink-0 items-center gap-4 border-b border-white/[.07] px-[26px]">
        <div className="font-mono text-[13px] font-bold tracking-[.06em]">EMP</div>
        <div className="h-4 w-px bg-white/[.12]" />
        {categoriesLocked ? (
          <div className="text-[13px] text-ink-2">{title}</div>
        ) : (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
            placeholder="New campaign"
            className="min-w-0 max-w-[280px] flex-1 bg-transparent text-[13px] text-ink-1 outline-none placeholder:text-ink-4"
          />
        )}
        <div className="whitespace-nowrap font-mono text-[10.5px] text-ink-5">
          {detail?.status === "REJECTED" ? "REJECTED · resubmit to re-review" : "DRAFT"}
          {savedSecondsAgo !== null && ` · saved ${savedSecondsAgo}s ago`}
        </div>
        <div className="ml-auto flex items-center gap-[10px]">
          <button
            onClick={() => void save()}
            disabled={saving || submitting || !canSave}
            className="rounded-md border border-white/[.12] px-[13px] py-2 text-[12.5px] text-ink-2 transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => void submitForApproval()}
            disabled={saving || submitting || !canSubmit}
            title={!hasComposedContent ? "Add a message before submitting for moderation." : undefined}
            className="rounded-md bg-pulse-cyan px-[15px] py-2 text-[12.5px] font-semibold text-onaccent-cyan transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit for moderation"}
          </button>
          <button onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink-1">
            ✕
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr_320px]">
        <StepRail steps={steps} accent="cyan" footnote="MODERATE → PAY → SEND. Rejected messages are never charged." />

        <div className="flex min-h-0 min-w-0 flex-col gap-[18px] overflow-y-auto px-[26px] py-6">
          {detail?.status === "REJECTED" && detail.rejectionReason && (
            <div className="rounded-card border border-pulse-red/40 bg-pulse-red/10 px-4 py-3 text-[12.5px]">
              <p className="font-medium text-pulse-red">Rejected by admin</p>
              <p className="mt-1 text-ink-2">{detail.rejectionReason}</p>
            </div>
          )}

          <TargetCategories
            categories={categories}
            selectedIds={selectedCategoryIds}
            locked={categoriesLocked}
            onToggle={toggleCategory}
          />

          <MessageCard
            bodyText={bodyText}
            onBodyTextChange={setBodyText}
            textLimit={textLimit}
            textOverLimit={textOverLimit}
            hasImage={hasImage}
            imagePreviewUrl={imagePreviewUrl}
            imageBusy={imageBusy}
            imageError={imageError}
            imageDisabled={!campaignId}
            onUploadImage={(file) => void uploadImage(file)}
            onRemoveImage={() => void removeImage()}
            ctas={ctas}
            onUpdateCta={updateCta}
            onAddCta={addCta}
            onRemoveCta={removeCta}
          />

          <ScheduleCard
            sendMode={sendMode}
            onSendModeChange={setSendMode}
            scheduledLocal={scheduledLocal}
            onScheduledLocalChange={setScheduledLocal}
          />

          <div className="flex flex-col gap-2">
            <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">04 · PREVIEW</div>
            <MessagePreview bodyText={bodyText} imageUrl={imagePreviewUrl ?? ""} ctas={ctas} />
          </div>

          {error && (
            <p role="alert" className="text-[12.5px] text-pulse-red">
              {error}
            </p>
          )}
        </div>

        <LiveRail audienceCount={audienceCount} countLoading={countLoading} flatCostPerUser={flatCostPerUser} />
      </div>
    </main>
  );
}
