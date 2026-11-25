import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

export type Slide = { icon: string; title: string; text: string };

// Auto-advancing carousel with arrows, dots, keyboard arrows and touch/mouse swipe.
// It pauses while the pointer is over it or focus is inside it.
export default function Slider({ slides, interval = 5200 }: { slides: Slide[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const count = slides.length;

  const go = (n: number) => setIndex(((n % count) + count) % count);

  useEffect(() => {
    if (paused) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => setIndex((v) => (v + 1) % count), interval);
    return () => window.clearInterval(id);
  }, [paused, count, interval]);

  return (
    <div
      className="home-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="home-slider-viewport"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(index + 1);
          if (e.key === 'ArrowLeft') go(index - 1);
        }}
        onPointerDown={(e) => {
          startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
        onPointerLeave={() => {
          startX.current = null;
        }}
      >
        <div className="home-slider-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, k) => (
            <article
              key={s.title}
              className={`home-slide home-glass ${k === index ? 'is-active' : ''}`}
              aria-roledescription="slide"
              aria-label={`${k + 1} of ${count}`}
              aria-hidden={k !== index}
            >
              <span className="home-ico-wrap">
                <Icon name={s.icon} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="home-slider-controls">
        <button type="button" className="home-arrow" aria-label="Previous slide" onClick={() => go(index - 1)}>
          <Icon name="chevronLeft" />
        </button>
        <div className="home-dots" role="tablist" aria-label="Choose slide">
          {slides.map((s, k) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={k === index}
              aria-label={`Go to slide ${k + 1}`}
              className={`home-dot ${k === index ? 'is-on' : ''}`}
              onClick={() => go(k)}
            />
          ))}
        </div>
        <button type="button" className="home-arrow" aria-label="Next slide" onClick={() => go(index + 1)}>
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
