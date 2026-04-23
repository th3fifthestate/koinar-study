'use client';

import { useCallback } from 'react';
import { ReaderOverlay } from './reader-overlay';
import { BranchMap } from './branch-map';
import { useEntityLayer } from './entity-layer-context';

interface BranchMapOverlayProps {
  open: boolean;
  onClose: () => void;
  studyTitle: string;
}

export function BranchMapOverlay({ open, onClose, studyTitle }: BranchMapOverlayProps) {
  const { openDrawer, exploredCount } = useEntityLayer();

  const handleNodeClick = useCallback(
    (entityId: string) => {
      openDrawer(entityId);
    },
    [openDrawer]
  );

  return (
    <ReaderOverlay
      open={open}
      onClose={onClose}
      variant="modal"
      stackLevel={50}
      ariaLabel={`Branch map with ${exploredCount} ${exploredCount === 1 ? 'entity' : 'entities'} explored`}
      className="p-0"
    >
      {/* Close button */}
      <div className="flex items-center justify-between border-b border-[var(--stone-200)] px-4 py-2 dark:border-[var(--stone-700)]">
        <span className="text-xs text-muted-foreground">
          {exploredCount} {exploredCount === 1 ? 'entity' : 'entities'} explored
        </span>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close map"
        >
          Close
        </button>
      </div>

      {/* Graph area — fill remaining space, no scroll */}
      <div className="flex-1 overflow-hidden p-4">
        <BranchMap studyTitle={studyTitle} onNodeClick={handleNodeClick} />
      </div>
    </ReaderOverlay>
  );
}
