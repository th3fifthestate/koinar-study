'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

interface CommunityToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  annotationCount: number;
  activeReaders?: number;
}

export function CommunityToggle({ enabled, onToggle, annotationCount, activeReaders = 0 }: CommunityToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onToggle} />
        <Label className="text-sm text-muted-foreground">
          Community ({annotationCount})
        </Label>
      </div>
      {activeReaders > 1 && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
          <Users className="h-3 w-3" />
          <span>{activeReaders} reading</span>
        </div>
      )}
    </div>
  );
}
