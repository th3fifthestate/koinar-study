'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface EntityToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  entityCount: number;
}

export function EntityToggle({ enabled, onToggle, entityCount }: EntityToggleProps) {
  if (entityCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Switch checked={enabled} onCheckedChange={onToggle} />
      <Label className="text-sm text-muted-foreground">
        Context ({entityCount})
      </Label>
    </div>
  );
}
