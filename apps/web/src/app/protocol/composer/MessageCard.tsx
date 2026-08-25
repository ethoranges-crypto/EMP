"use client";

import { useRef } from "react";
import { CTA_LABEL_MAX_LENGTH, MAX_CTAS_PER_CAMPAIGN } from "@emp/config/telegramLimits";
import { CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES, CAMPAIGN_IMAGE_MAX_BYTES } from "@emp/config/campaignLimits";

interface CtaDraft {
  label: string;
  targetUrl: string;
}

const IMAGE_ACCEPT = CAMPAIGN_IMAGE_ALLOWED_MIME_TYPES.join(",");
const IMAGE_MAX_MB = (CAMPAIGN_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0);

/**
 * The design's "02 · MESSAGE" card, made real: the plain text/image/CTA
 * block the mockup shows is actually this screen's editor, not a preview —
 * a separate live phone-frame preview (MessagePreview) sits below it in
 * Composer, preserving that existing feature since the design's fixed
 * single-screen layout had no room for it.
 *
 * Image upload needs an existing campaignId (its own endpoint, POST
 * .../campaigns/:id/image — a file, not a form field that can ride along
 * with a first save) — disabled with an explanatory title until a draft
 * exists, same real constraint the old two-screen flow had (image upload
 * only ever existed on the Compose screen, which only appeared after a
 * draft had already been created).
 */
export function MessageCard({
  bodyText,
  onBodyTextChange,
  textLimit,
  textOverLimit,
  hasImage,
  imagePreviewUrl,
  imageBusy,
  imageError,
  imageDisabled,
  onUploadImage,
  onRemoveImage,
  ctas,
  onUpdateCta,
  onAddCta,
  onRemoveCta,
}: {
  bodyText: string;
  onBodyTextChange: (value: string) => void;
  textLimit: number;
  textOverLimit: boolean;
  hasImage: boolean;
  imagePreviewUrl: string | null;
  imageBusy: boolean;
  imageError: string | null;
  imageDisabled: boolean;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
  ctas: CtaDraft[];
  onUpdateCta: (index: number, field: keyof CtaDraft, value: string) => void;
  onAddCta: () => void;
  onRemoveCta: (index: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atCtaCap = ctas.length >= MAX_CTAS_PER_CAMPAIGN;

  return (
    <div className="flex min-h-0 flex-col gap-[10px]">
      <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">02 · MESSAGE</div>
      <div className="flex flex-col gap-[14px] rounded-card border border-white/[.1] bg-surface p-4">
        <div className="flex flex-col gap-1">
          <textarea
            value={bodyText}
            onChange={(e) => onBodyTextChange(e.target.value)}
            rows={4}
            placeholder="What should EMP send?"
            className={`resize-none rounded-md border bg-transparent px-2 py-1.5 text-[13.5px] leading-[1.6] text-ink-1 outline-none placeholder:text-ink-5 focus:border-white/20 ${
              textOverLimit ? "border-pulse-red/60" : "border-transparent"
            }`}
          />
          <div className="flex items-center justify-between">
            {hasImage && (
              <span className="text-[11px] text-ink-5">
                An image attaches this text as a caption, which Telegram caps lower than a plain message.
              </span>
            )}
            <span className={`ml-auto font-mono text-[11px] ${textOverLimit ? "text-pulse-red" : "text-ink-5"}`}>
              {bodyText.length} / {textLimit}
            </span>
          </div>
        </div>

        {imagePreviewUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl} alt="" className="h-[70px] w-[70px] shrink-0 rounded-md border border-white/10 object-cover" />
            <button
              type="button"
              onClick={onRemoveImage}
              disabled={imageBusy}
              className="rounded-chip border border-white/[.14] px-3 py-1.5 text-[11.5px] text-ink-3 transition hover:border-white/25 disabled:opacity-50"
            >
              {imageBusy ? "Removing…" : "Remove image"}
            </button>
          </div>
        ) : (
          <label
            title={imageDisabled ? "Save a draft first to attach an image." : undefined}
            className={`flex h-[110px] flex-col items-center justify-center gap-1 rounded-md border border-white/[.1] text-center font-mono text-[10.5px] text-ink-5 ${
              imageDisabled || imageBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-white/20"
            }`}
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #0d1216 0 8px, #101619 8px 16px)",
            }}
          >
            {imageBusy ? "Uploading…" : "campaign image · 1200×628"}
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              disabled={imageDisabled || imageBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadImage(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="hidden"
            />
          </label>
        )}
        {imageError && <p className="text-[11px] text-pulse-red">{imageError}</p>}
        {!imagePreviewUrl && !imageDisabled && (
          <p className="-mt-2 text-[11px] text-ink-5">JPEG, PNG, or WebP — max {IMAGE_MAX_MB}MB.</p>
        )}

        <div className="flex flex-col gap-[9px]">
          {ctas.map((cta, i) => {
            const labelOverLimit = cta.label.length > CTA_LABEL_MAX_LENGTH;
            return (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cta.label}
                  onChange={(e) => onUpdateCta(i, "label", e.target.value)}
                  placeholder="Label"
                  className={`w-[130px] rounded-md border bg-void px-[11px] py-[9px] text-center text-[12.5px] font-medium text-pulse-cyan outline-none focus:border-pulse-cyan/50 ${
                    labelOverLimit ? "border-pulse-red/60" : "border-pulse-cyan/40"
                  }`}
                />
                <input
                  type="text"
                  value={cta.targetUrl}
                  onChange={(e) => onUpdateCta(i, "targetUrl", e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-md border border-white/[.14] bg-void px-[11px] py-[9px] text-[12.5px] text-ink-2 outline-none focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={() => onRemoveCta(i)}
                  aria-label="Remove CTA"
                  className="shrink-0 rounded-full px-2 py-1 text-ink-5 hover:text-ink-2"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onAddCta}
            disabled={atCtaCap}
            className="self-start rounded-chip border border-white/[.14] px-[13px] py-[7px] text-[12px] text-ink-3 transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add CTA ({ctas.length}/{MAX_CTAS_PER_CAMPAIGN})
          </button>
        </div>

        <div className="border-t border-white/[.06] pt-2 font-mono text-[10.5px] leading-[1.4] text-ink-5">
          CTAs auto-wrapped to a tracked EMP redirect (/r/:token) · click-through is the only engagement signal
          Telegram gives us
        </div>
      </div>
    </div>
  );
}
