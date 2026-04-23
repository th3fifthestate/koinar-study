'use client';

import type { ReactNode } from 'react';
import { useCopyCap } from '@/components/shared/useCopyCap';
import type { DisplaySurface } from '@/lib/bench/types';

interface CopyGuardProps {
  children: ReactNode;
  currentTranslation: string;
  surface?: DisplaySurface;
}

export function CopyGuard({ children, currentTranslation, surface }: CopyGuardProps) {
  const defaultSurface: DisplaySurface = { kind: 'reader', studyId: 'unknown' };
  const { containerRef } = useCopyCap({
    surface: surface ?? defaultSurface,
    currentTranslation,
  });
  return <div ref={containerRef}>{children}</div>;
}
