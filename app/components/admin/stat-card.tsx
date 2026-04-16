import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  trend?: string;
  highlighted?: boolean;
}

export function StatCard({ title, value, description, trend, highlighted }: StatCardProps) {
  return (
    <Card className={cn(highlighted && 'border-amber-500')}>
      <CardHeader className="pb-2">
        <CardTitle
          className={cn(
            'text-sm font-medium text-muted-foreground',
            highlighted && 'text-amber-600'
          )}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', highlighted && 'text-amber-700')}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}
