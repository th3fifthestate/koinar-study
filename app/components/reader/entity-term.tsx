'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { useEntityLayer } from './entity-layer-context';
import { EntityPopover } from './entity-popover';

interface EntityTermProps {
  entityId: string;
  children: ReactNode;
}

export function EntityTerm({ entityId, children }: EntityTermProps) {
  const { entityMap, showAnnotations, openDrawer, benchEnabled } = useEntityLayer();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const entity = entityMap.get(entityId) ?? null;

  const handleExplore = useCallback(() => {
    setPopoverOpen(false);
    openDrawer(entityId);
  }, [entityId, openDrawer]);

  const handleClipToBench = useCallback(async () => {
    if (!entity) return
    const payload = {
      type: 'entity',
      source_ref: { type: 'entity', entity_id: entity.id, tier: 'quick_glance' },
    }
    try {
      await fetch('/api/bench/recent-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: JSON.stringify(payload),
          clipped_from_route: window.location.pathname,
        }),
      })
      toast.success('Entity clipped to Bench', {
        action: { label: 'View', onClick: () => window.open('/bench', '_blank') },
      })
    } catch {
      toast.error('Failed to clip to Bench')
    }
  }, [entity]);

  if (!showAnnotations) {
    return <>{children}</>;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        className="cursor-pointer border-b-2 border-dotted border-[var(--reader-accent)] transition-colors duration-200 hover:border-[var(--reader-accent-deep)]"
        role="button"
        tabIndex={0}
        aria-label={entity ? `Learn about ${entity.canonical_name}` : 'Entity reference'}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="max-w-[320px] p-4" side="bottom" sideOffset={6}>
        {entity ? (
          <EntityPopover entity={entity} onExplore={handleExplore} onClipToBench={benchEnabled ? handleClipToBench : undefined} />
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Context not yet available for this reference.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
