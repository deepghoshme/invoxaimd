"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Swipeable product image slider with optional auto-scroll. CSS scroll-snap does
 * the swiping; dots scrub. Images auto-fit (contain) so nothing is cropped.
 * Auto-scroll pauses briefly after a manual interaction so it never fights the user.
 */
export default function ImageSlider({
  images,
  alt,
  autoplay = false,
  intervalMs = 4000,
}: {
  images: string[];
  alt: string;
  autoplay?: boolean;
  intervalMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  }

  function go(i: number, smooth = true) {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }

  function nudge() {
    pausedUntil.current = performance.now() + Math.max(intervalMs, 3500);
  }

  useEffect(() => {
    if (!autoplay || images.length < 2) return;
    const ms = Math.max(1500, intervalMs);
    const id = setInterval(() => {
      const el = ref.current;
      if (!el || performance.now() < pausedUntil.current) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      const next = (cur + 1) % images.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, ms);
    return () => clearInterval(id);
  }, [autoplay, intervalMs, images.length]);

  if (images.length === 0) return null;

  return (
    <div className="slider">
      <div
        className="slider-track"
        ref={ref}
        onScroll={onScroll}
        onPointerDown={nudge}
        onTouchStart={nudge}
      >
        {images.map((src, i) => (
          <div className="slider-slide" key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${alt} ${i + 1}`} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="slider-dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`slider-dot${i === active ? " on" : ""}`}
              aria-label={`Image ${i + 1}`}
              onClick={() => {
                nudge();
                go(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
