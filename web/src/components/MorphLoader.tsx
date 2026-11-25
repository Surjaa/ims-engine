// A small loader that morphs between a circle and a rounded square while it turns.
// Used on busy buttons. Colour follows the surrounding text colour.

const CIRCLE =
  "M12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3Z";
const SQUIRCLE =
  "M12 3C19.5 3 21 4.5 21 12C21 19.5 19.5 21 12 21C4.5 21 3 19.5 3 12C3 4.5 4.5 3 12 3Z";

export function MorphLoader({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="morph-loader"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        d={CIRCLE}
      >
        <animate
          attributeName="d"
          values={`${CIRCLE};${SQUIRCLE};${CIRCLE}`}
          keyTimes="0;0.5;1"
          dur="1.6s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      </path>
    </svg>
  );
}
