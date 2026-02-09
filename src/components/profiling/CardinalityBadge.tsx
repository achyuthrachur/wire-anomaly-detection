import type { CategoricalProfile } from '@/lib/db/types';
import { Badge } from '@/components/ui/badge';

interface CardinalityBadgeProps {
  name: string;
  profile: CategoricalProfile;
}

export function CardinalityBadge({ name, profile }: CardinalityBadgeProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-semibold">{profile.unique}</span>
        <Badge variant="outline" className="text-[10px]">unique</Badge>
      </div>
      {profile.topValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {profile.topValues.slice(0, 5).map((tv) => (
            <Badge key={tv.value} variant="secondary" className="text-[10px]">
              {tv.value} ({tv.count})
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
