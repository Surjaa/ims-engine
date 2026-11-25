// IMS Engine logo: a bold capital "I" (for Inventory Management System) on a blue-to-cyan tile,
// with an amber dot. Keep in sync with web/public/logo.svg (favicon and link previews).
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
      <rect x="21" y="13" width="22" height="8" rx="4" fill="#ffffff" />
      <rect x="28" y="19" width="8" height="26" rx="2" fill="#ffffff" />
      <rect x="21" y="43" width="22" height="8" rx="4" fill="#ffffff" />
      <circle cx="49" cy="14" r="4.5" fill="#F59E0B" />
    </svg>
  );
}
