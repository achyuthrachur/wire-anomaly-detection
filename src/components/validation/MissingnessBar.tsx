import { cn } from '@/lib/utils';

interface MissingnessBarProps {
  column: string;
  percentage: number;
}

export function MissingnessBar({ column, percentage }: MissingnessBarProps) {
  const pct = Math.round(percentage * 100 * 100) / 100;

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 truncate text-xs font-medium text-foreground">{column}</span>
      <div className="flex-1 h-2 rounded-full bg-tint-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct === 0 ? 'bg-crowe-teal' : pct < 5 ? 'bg-crowe-amber' : 'bg-crowe-coral'
          )}
          style={{ width: `${Math.max(pct === 0 ? 100 : pct, 2)}%` }}
        />
      </div>
      <span className="w-14 text-right text-xs text-muted-foreground">
        {pct === 0 ? 'Complete' : `${pct}%`}
      </span>
    </div>
  );
}
