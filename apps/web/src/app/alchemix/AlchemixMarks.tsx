/**
 * Alchemix's real brand assets, transcribed verbatim from the SVG source
 * supplied for this page (not a guess/recreation) — see git history for the
 * exact source if these ever need re-diffing against a future asset update.
 */

const WORDMARK_VIEWBOX_WIDTH = 987.6;
const WORDMARK_VIEWBOX_HEIGHT = 187.7;
const WORDMARK_ASPECT_RATIO = WORDMARK_VIEWBOX_WIDTH / WORDMARK_VIEWBOX_HEIGHT;

/** The combined icon + "ALCHEMIX" wordmark lockup, as used in the header. */
export function AlchemixWordmark({ height = 26 }: { height?: number }) {
  const width = height * WORDMARK_ASPECT_RATIO;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${WORDMARK_VIEWBOX_WIDTH} ${WORDMARK_VIEWBOX_HEIGHT}`}
      style={{ display: "block" }}
      role="img"
      aria-label="Alchemix"
    >
      <g fill="#edc29f">
        <rect x="617.7" y="45.3" width="63.9" height="16.1" />
        <polygon points="676.5 85.7 617.7 85.7 617.7 101.8 668.9 101.8 676.5 85.7" />
        <rect x="617.7" y="126.1" width="65.7" height="16.1" />
        <path d="M254.9,45.5h-2.8l-42.2,96.8h16.6l9.6-23.3h33l9.2,23.3h18.8l-41.8-95.9s-.4-.9-.4-.9ZM242,104.4l10.9-23.6,10.4,23.6h-21.3,0Z" />
        <polygon points="336.4 45.1 320 45.1 320 142.3 383.1 142.3 383.1 126.2 336.4 126.2 336.4 45.1" />
        <path d="M469.6,120.5c-2.2,1.8-5.1,3.4-8.7,4.8h0c-3.5,1.4-7.6,2.1-12.3,2.1s-12.2-1.5-16.9-4.3c-4.8-2.9-8.5-6.9-11.1-11.9-2.6-5.1-3.9-10.9-3.9-17.3s1.4-12.1,4.3-17.1c2.9-5.1,6.7-9.1,11.5-12.1,4.7-3,10-4.5,15.5-4.5s8.2.7,11.7,2.2c3.6,1.5,6.6,3.1,9,4.8l1.5,1.1,6.7-15.7-1.1-.7c-3.3-2.1-7.4-3.9-12.2-5.5-4.8-1.6-10.2-2.4-16.1-2.4s-13.4,1.3-19.3,3.8-11,6.1-15.3,10.6c-4.3,4.5-7.7,9.9-10,16-2.4,6.1-3.6,12.9-3.6,20.2s1.1,12.9,3.4,18.7c2.2,5.8,5.5,11.1,9.8,15.6,4.2,4.5,9.4,8.1,15.4,10.7,6,2.6,12.8,3.9,20.4,4h1.1c4.1,0,7.9-.5,11.4-1.4,3.8-1,7.1-2.2,9.9-3.6,2.8-1.4,5-2.6,6.5-3.5l1.1-.7-7.3-15.2-1.5,1.2h.1Z" />
        <polygon points="568.7 85.5 524.1 85.5 524.1 45.1 507.8 45.1 507.8 142.3 524.1 142.3 524.1 101.5 568.7 101.5 568.7 142.3 585.2 142.3 585.2 45.1 568.7 45.1 568.7 85.5" />
        <polygon points="763.5 108.1 718.3 45.1 715.9 45.1 715.9 142.3 731.9 142.3 731.9 90.8 762.4 132.5 764.2 132.5 795.6 88.8 795.6 142.3 811.9 142.3 811.9 45.1 809.4 45.1 763.5 108.1" />
        <rect x="843.4" y="45.3" width="16.3" height="97" />
        <polygon points="938.8 93.2 969.2 45.3 949.4 45.3 929.6 79 907.9 45.3 887.4 45.3 917.6 92.4 886.1 142.3 906.2 142.3 926.9 107 949.6 142.3 970.5 142.3 938.8 93.2" />
      </g>
      <g fill="none" stroke="#edc29f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <circle cx="96.1" cy="93.9" r="79.1" />
        <line x1="96.1" y1="116.8" x2="96.1" y2="173" />
        <line x1="96.1" y1="14.8" x2="96.1" y2="31.4" />
        <g>
          <polyline points="96.1 116.8 42.2 74.1 96.1 31.4 150 74.1 125.9 93.2" />
          <polyline points="141.7 120.5 150 114 150 74.1" />
          <polyline points="42.2 74.1 42.2 114 96.1 156.7 120.4 137.4" />
        </g>
        <g>
          <polyline points="51.6 121.5 42.4 137.4 71.8 137.4" />
          <polyline points="96.1 137.4 149.8 137.4 96.1 44.5 68 93" />
        </g>
      </g>
    </svg>
  );
}

/** The standalone icon/mark, as used in the alert-preview panel. */
export function AlchemixMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 302.4 302.4" role="img" aria-label="Alchemix">
      <circle cx="151.2" cy="151.2" r="151.2" fill="#252736" />
      <g fill="none" stroke="#f5c09a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5">
        <circle cx="151.2" cy="151.2" r="138.3" />
        <line x1="151.2" y1="191.2" x2="151.2" y2="289.5" />
        <line x1="151.2" y1="12.9" x2="151.2" y2="42.1" />
        <g>
          <polyline points="151.2 191.2 56.9 116.6 151.2 42.1 245.4 116.6 203.3 149.9" />
          <polyline points="231 197.8 245.4 186.3 245.4 116.6" />
          <polyline points="56.9 116.6 56.9 186.3 151.2 260.9 193.6 227.2" />
        </g>
        <g>
          <polyline points="73.5 199.4 57.4 227.2 108.7 227.2" />
          <polyline points="151.2 227.2 245 227.2 151.2 64.8 102.2 149.7" />
        </g>
      </g>
    </svg>
  );
}
