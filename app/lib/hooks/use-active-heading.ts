'use client';

import { useState, useEffect } from 'react';

export function useActiveHeading(headingIds: string[]) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (headingIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry (closest to top)
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (intersecting.length > 0) {
          setActiveId(intersecting[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    for (const id of headingIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headingIds]);

  return activeId;
}
