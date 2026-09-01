"use client";

interface PreviewCta {
  label: string;
  targetUrl: string;
}

/**
 * A faithful mockup of how this message actually renders in Telegram — not
 * EMP's own brand chrome. The phone frame and section heading around it
 * stay on-brand (SPEC §13); the screen contents inside deliberately mimic
 * Telegram's real default light theme (white bubble, its blue for link
 * buttons, etc.), since the whole point is showing the protocol what their
 * recipient sees in a completely different app.
 *
 * Purely presentational — driven by the same live draft state the compose
 * form edits, so it updates on every keystroke. CTAs render as inline
 * keyboard buttons stacked below the bubble, one per row, matching how a
 * `url` button actually attaches to a Telegram message.
 */
export function MessagePreview({
  bodyText,
  imageUrl,
  ctas,
}: {
  bodyText: string;
  imageUrl: string;
  ctas: PreviewCta[];
}) {
  const hasText = bodyText.trim().length > 0;
  const hasImage = imageUrl.trim().length > 0;
  const visibleCtas = ctas.filter((c) => c.label.trim().length > 0);

  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[2rem] border-4 border-white/10 bg-black p-2 shadow-glow">
      <div className="flex items-center justify-center gap-1 pb-1.5">
        <div className="h-1.5 w-10 rounded-full bg-white/20" />
      </div>
      <div className="flex flex-col gap-2 rounded-[1.4rem] px-3 py-3" style={{ backgroundColor: "#e7ebf0" }}>
        <div className="flex items-center gap-2 pb-1">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: "#3390ec" }}
          >
            E
          </div>
          <span className="text-xs font-medium" style={{ color: "#1c1c1e" }}>
            EMP Bot
          </span>
        </div>

        {!hasText && !hasImage && (
          <p className="py-6 text-center text-xs" style={{ color: "#8e8e93" }}>
            Start typing to preview the message
          </p>
        )}

        {(hasText || hasImage) && (
          <div className="flex flex-col">
            <div
              className="overflow-hidden rounded-2xl shadow-sm"
              style={{ backgroundColor: "#ffffff", borderRadius: visibleCtas.length > 0 ? "16px 16px 0 0" : "16px" }}
            >
              {hasImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-36 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              {hasText && (
                <p
                  className="whitespace-pre-wrap break-words px-3 py-2 text-[13px] leading-snug"
                  style={{ color: "#1c1c1e" }}
                >
                  {bodyText}
                </p>
              )}
              <p className="px-3 pb-1.5 text-right text-[10px]" style={{ color: "#8e8e93" }}>
                12:34 PM
              </p>
            </div>

            {visibleCtas.map((cta, i) => (
              <div
                key={i}
                className="border-x border-b px-3 py-2 text-center text-[13px] font-medium"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e0e0e2",
                  color: "#3390ec",
                  borderRadius: i === visibleCtas.length - 1 ? "0 0 16px 16px" : undefined,
                }}
              >
                {cta.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
