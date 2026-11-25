// Endless horizontal ticker. Items are duplicated so the loop has no gap.
// reverse: scrolls right to left instead. variant "chips" shows each item as a glass pill.
export default function Marquee({
  items,
  reverse = false,
  variant = "text",
}: {
  items: string[];
  reverse?: boolean;
  variant?: "text" | "chips";
}) {
  return (
    <div
      className={`home-marquee ${variant === "chips" ? "is-chips" : ""}`}
      aria-hidden="true"
    >
      <div className={`home-marquee-track ${reverse ? "is-reverse" : ""}`}>
        {[0, 1].map((g) => (
          <div className="home-marquee-group" key={g}>
            {items.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
