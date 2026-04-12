'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CommunityToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  annotationCount: number;
}

export function CommunityToggle({ enabled, onToggle, annotationCount }: CommunityToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={enabled} onCheckedChange={onToggle} />
      <Label className="text-sm text-muted-foreground">
        Community highlights ({annotationCount})
      </Label>
    </div>
  );
}
