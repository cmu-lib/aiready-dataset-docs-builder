// Horizontal, snap-scrolling carousel with looping prev/next and dot controls.
// Arrows sit in the gutters beside the card (not overlapping content); dots
// below. Keeps tall informational content compact.

import { Children, useRef, useState } from 'react';

export default function Carousel({ children, label = 'Information' }) {
  const slides = Children.toArray(children);
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const many = slides.length > 1;

  const go = (n) => {
    const count = slides.length;
    if (!count) return;
    const next = ((n % count) + count) % count; // wrap-around (loop)
    setIdx(next);
    const t = trackRef.current;
    if (t) t.scrollTo({ left: t.clientWidth * next, behavior: 'smooth' });
  };

  const onScroll = () => {
    const t = trackRef.current;
    if (t) setIdx(Math.round(t.scrollLeft / t.clientWidth));
  };

  const arrowClass =
    'grid h-10 w-10 shrink-0 self-center place-items-center border border-line text-ink transition-colors hover:border-ink hover:bg-surface-2';

  return (
    <div aria-roledescription="carousel" aria-label={label}>
      <div className="flex items-stretch gap-2 sm:gap-3">
        {many && (
          <button type="button" onClick={() => go(idx - 1)} aria-label="Previous" className={arrowClass}>
            ←
          </button>
        )}

        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => (
            <div key={i} className="min-w-full snap-center" aria-hidden={i !== idx}>
              <div className="h-full">{slide}</div>
            </div>
          ))}
        </div>

        {many && (
          <button type="button" onClick={() => go(idx + 1)} aria-label="Next" className={arrowClass}>
            →
          </button>
        )}
      </div>

      {many && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1} of ${slides.length}`}
              aria-current={i === idx}
              className={`h-2 w-2 transition-colors ${i === idx ? 'bg-accent' : 'bg-idle-bg hover:bg-muted'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
