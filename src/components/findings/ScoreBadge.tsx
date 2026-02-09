'use client';

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

function getScoreColor(score: number): {
  text: string;
  bar: string;
  bg: string;
} {
  if (score < 0.3) {
    return {
      text: 'text-emerald-700',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-50',
    };
  }
  if (score <= 0.7) {
    return {
      text: 'text-crowe-amber-dark',
      bar: 'bg-crowe-amber',
      bg: 'bg-amber-50',
    };
  }
  return {
    text: 'text-crowe-coral',
    bar: 'bg-crowe-coral',
    bg: 'bg-red-50',
  };
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const colors = getScoreColor(score);
  const pct = Math.round(score * 100);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('text-sm font-semibold tabular-nums', colors.text)}>
        {score.toFixed(3)}
      </span>
      <div className={cn('relative h-2 w-16 overflow-hidden rounded-full', colors.bg)}>
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', colors.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
