"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CTA_LABEL_MAX_LENGTH, MAX_CTAS_PER_CAMPAIGN, telegramTextLimit } from "@emp/config/telegramLimits";
import { CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES, CAMPAIGN_IMAGE_MAX_BYTES } from "@emp/config/campaignLimits";
import type { CampaignDetail } from "./types";
import { MessagePreview } from "./MessagePreview";

interface CtaDraft {
  label: string;
  targetUrl: string;
}

const IMAGE_ACCEPT = CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES.join(",");
const IMAGE_MAX_MB = (CAMPAIGN_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0);

/**
 * SPEC §4.3 step 2 / §8: text, optional uploaded image, up to
 * MAX_CTAS_PER_CAMPAIGN CTAs — saved onto the existing DRAFT campaign. The
 * preview on the right shows exactly what the recipient will see; the
 * /r/:token wrapping that happens on save is intentionally invisible here
 * (SPEC §8 handles it, the protocol just needs to know links are tracked,
 * not the tokens themselves).
 *
 * The image is uploaded (and removed) immediately via its own endpoint,
 * separately from "Save draft" — it's a file, not a form field, so it has
 * its own request/response instead of riding along with text/CTAs. That
 * also means an empty/no image can never block saving text/CTAs: the two
 * are independent actions.
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
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ctas, setCtas] = useState<CtaDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/protocol/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((data: CampaignDetail) => {
        setDetail(data);
        setBodyText(data.bodyText ?? "");
        setImagePreviewUrl(data.imageUrl);
        setCtas(data.ctas.map((c) => ({ label: c.label, targetUrl: c.targetUrl })));
      });
  }, [campaignId]);

  const hasImage = imagePreviewUrl !== null;
  const textLimit = telegramTextLimit(hasImage);
  const textOverLimit = bodyText.length > textLimit;
  const atCtaCap = ctas.length >= MAX_CTAS_PER_CAMPAIGN;

  const canSave = useMemo(
    () => !textOverLimit && ctas.every((c) => c.label.length <= CTA_LABEL_MAX_LENGTH),
    [textOverLimit, ctas],
  );

  function updateCta(index: number, field: keyof CtaDraft, value: string) {
    setCtas((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addCta() {
    if (atCtaCap) return;
    setCtas((prev) => [...prev, { label: "", targetUrl: "" }]);
  }

  function removeCta(index: number) {
    setCtas((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadImage(file: File) {
    setImageError(null);
    if (!(CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      setImageError(`Unsupported file type — use ${IMAGE_ACCEPT.replaceAll("image/", "")}.`);
      return;
    }
    if (file.size > CAMPAIGN_IMAGE_MAX_BYTES) {
      setImageError(`Image is too large — max ${IMAGE_MAX_MB}MB.`);
      return;
    }

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
    // Cache-bust so the browser doesn't reuse a previously-cached response for the same URL.
    setImagePreviewUrl(`/api/protocol/campaigns/${campaignId}/image?t=${Date.now()}`);
  }

  async function removeImage() {
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyText, ctas }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save.");
      return;
    }
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Compose — {detail.title}</h2>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-100">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Message text</span>
              <span className={`text-xs ${textOverLimit ? "text-red-400" : "text-slate-500"}`}>
                {bodyText.length} / {textLimit}
              </span>
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              className={`rounded-md border bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50 ${
                textOverLimit ? "border-red-500/60" : "border-white/10"
              }`}
            />
            {hasImage && (
              <span className="text-xs text-slate-500">
                An image attaches this text as a caption, which Telegram caps lower than a plain message.
              </span>
            )}
          </label>

          <div className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Image (optional)</span>
            {imagePreviewUrl && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="h-16 w-16 rounded-md border border-white/10 object-cover"
                />
                <button
                  onClick={() => void removeImage()}
                  disabled={imageBusy}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-xs text-slate-100 hover:bg-white/20 disabled:opacity-50"
                >
                  {imageBusy ? "Removing…" : "Remove image"}
                </button>
              </div>
            )}
            {!imagePreviewUrl && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  disabled={imageBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                  className="text-xs text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-1.5 file:text-xs file:text-slate-100 hover:file:bg-white/20"
                />
                <p className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP — max {IMAGE_MAX_MB}MB.</p>
              </div>
            )}
            {imageError && (
              <p role="alert" className="text-xs text-red-400">
                {imageError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">CTAs</p>
              <span className="text-xs text-slate-500">
                {ctas.length} / {MAX_CTAS_PER_CAMPAIGN}
              </span>
            </div>
            {ctas.map((cta, i) => {
              const labelOverLimit = cta.label.length > CTA_LABEL_MAX_LENGTH;
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cta.label}
                      onChange={(e) => updateCta(i, "label", e.target.value)}
                      placeholder="Label (e.g. Claim)"
                      className={`w-32 rounded-md border bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50 ${
                        labelOverLimit ? "border-red-500/60" : "border-white/10"
                      }`}
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
                  {labelOverLimit && (
                    <span className="text-xs text-red-400">Max {CTA_LABEL_MAX_LENGTH} characters.</span>
                  )}
                </div>
              );
            })}
            <button
              onClick={addCta}
              disabled={atCtaCap}
              className="self-start rounded-full bg-white/10 px-4 py-1.5 text-sm text-slate-100 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add CTA
            </button>
          </div>

          <button
            onClick={() => void save()}
            disabled={saving || !canSave}
            className="self-start rounded-full bg-pulse-violet px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-500">Links are tracked — delivered/click metrics land on your dashboard.</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-center text-xs uppercase tracking-wide text-slate-500">Preview</p>
          <MessagePreview bodyText={bodyText} imageUrl={imagePreviewUrl ?? ""} ctas={ctas} />
        </div>
      </div>
    </section>
  );
}
