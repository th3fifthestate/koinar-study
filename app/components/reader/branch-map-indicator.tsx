'use client';

import { useEntityLayer } from './entity-layer-context';

interface BranchMapIndicatorProps {
  onOpenMap: () => void;
}

export function BranchMapIndicator({ onOpenMap }: BranchMapIndicatorProps) {
  const { exploredCount } = useEntityLayer();

  if (exploredCount === 0) return null;

  const label = exploredCount === 1 ? '1 entity' : `${exploredCount} entities`;

  return (
    <button
      onClick={onOpenMap}
      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`${label} explored. Open branch map.`}
    >
      <span>{label} explored</span>
      <span aria-hidden="true">·</span>
      <span className="text-[var(--sage-500)]">View map</span>
    </button>
  );
}
