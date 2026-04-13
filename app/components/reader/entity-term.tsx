'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { useEntityLayer } from './entity-layer-context';
import { EntityPopover } from './entity-popover';

interface EntityTermProps {
  entityId: string;
  children: ReactNode;
}

export function EntityTerm({ entityId, children }: EntityTermProps) {
  const { entityMap, showAnnotations, openDrawer } = useEntityLayer();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const entity = entityMap.get(entityId) ?? null;

  const handleExplore = useCallback(() => {
    setPopoverOpen(false);
    openDrawer(entityId);
  }, [entityId, openDrawer]);

  if (!showAnnotations) {
    return <>{children}</>;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        className="cursor-pointer border-b-[1.5px] border-dotted border-[var(--sage-300)] transition-colors duration-200 hover:border-[var(--sage-500)]"
        role="button"
        tabIndex={0}
        aria-label={entity ? `Learn about ${entity.canonical_name}` : 'Entity reference'}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="max-w-[320px] p-4" side="bottom" sideOffset={6}>
        {entity ? (
          <EntityPopover entity={entity} onExplore={handleExplore} />
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Context not yet available for this reference.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
