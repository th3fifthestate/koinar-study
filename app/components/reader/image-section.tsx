'use client';

import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';

interface ImageSectionProps {
  imageUrl: string;
  caption: string | null;
  index: number;
}

export function ImageSection({ imageUrl, caption, index }: ImageSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <figure className="my-10 -mx-4 md:mx-0">
      <div className="relative h-[300px] overflow-hidden rounded-lg md:h-[400px]">
        <Image
          src={imageUrl}
          alt={caption || 'Study illustration'}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-cover"
          style={
            prefersReducedMotion
              ? undefined
              : {
                  animation: `${index % 2 === 0 ? 'kenBurns' : 'kenBurnsAlt'} 30s ease-in-out infinite alternate`,
                }
          }
        />
      </div>
      {caption && (
        <figcaption className="mt-2 px-4 text-center text-sm text-[var(--stone-300)] md:px-0">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
