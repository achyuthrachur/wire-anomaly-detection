'use client';

import { cn } from '@/lib/utils';

interface MetricsBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export function MetricsBar({ label, value, max = 1.0, color }: MetricsBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const displayValue = value <= 1 ? value.toFixed(4) : value.toFixed(2);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium tabular-nums">{displayValue}</span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full transition-all duration-500', {
            'bg-crowe-indigo-dark': !color,
          })}
          style={{
            width: `${percentage}%`,
            ...(color ? { backgroundColor: color } : {}),
          }}
        />
      </div>
    </div>
  );
}
