// IMS Engine logo: three stacked stock boxes on a blue-to-cyan tile, with an amber dot for profit.
// Keep in sync with web/public/logo.svg (used for the favicon and link previews).
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className="brand-mark"
    >
      <defs>
        <linearGradient id="ims-brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#ims-brand-g)" />
      <rect x="23.5" y="16" width="17" height="12" rx="3" fill="#ffffff" />
      <rect
        x="12"
        y="34"
        width="17"
        height="12"
        rx="3"
        fill="#ffffff"
        fillOpacity="0.92"
      />
      <rect
        x="35"
        y="34"
        width="17"
        height="12"
        rx="3"
        fill="#ffffff"
        fillOpacity="0.92"
      />
      <circle cx="49" cy="14" r="5" fill="#F59E0B" />
    </svg>
  );
}
