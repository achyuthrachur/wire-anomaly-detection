'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ReasonCodeEntry {
  code: string;
  description: string;
  contribution: 'high' | 'medium' | 'low';
}

interface ReasonCodeChipsProps {
  codes: ReasonCodeEntry[];
  className?: string;
}

const contributionStyles: Record<ReasonCodeEntry['contribution'], string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-gray-100 text-tint-700 border-gray-200',
};

export function ReasonCodeChips({ codes, className }: ReasonCodeChipsProps) {
  if (!codes || codes.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {codes.map((entry) => (
        <Badge
          key={entry.code}
          variant="outline"
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            contributionStyles[entry.contribution]
          )}
          title={entry.description}
        >
          {entry.code}
        </Badge>
      ))}
    </div>
  );
}
