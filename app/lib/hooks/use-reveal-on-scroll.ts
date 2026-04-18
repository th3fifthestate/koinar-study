// app/lib/hooks/use-reveal-on-scroll.ts
"use client";
import { useEffect, type RefObject } from "react";

export function useRevealOnScroll(
  selector: string,
  rootRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const root = rootRef?.current ?? document;
    const elements = root.querySelectorAll(selector);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    elements.forEach((el) => observer.observe(el));

    // Elements already in the viewport at mount get .visible in the next
    // animation frame. rAF waits for layout to stabilise (fonts, images).
    // classList.add is idempotent — safe if observer fires first.
    requestAnimationFrame(() => {
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add("visible");
        }
      });
    });

    return () => observer.disconnect();
  }, [selector, rootRef]);
}
