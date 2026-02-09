'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, type LucideIcon } from 'lucide-react';

type SectionStatus = 'pass' | 'warn' | 'fail';

interface ValidationSectionProps {
  title: string;
  status: SectionStatus;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const statusColors: Record<SectionStatus, string> = {
  pass: 'text-crowe-teal',
  warn: 'text-crowe-amber-dark',
  fail: 'text-crowe-coral',
};

export function ValidationSection({
  title,
  status,
  icon: Icon,
  defaultOpen = false,
  children,
}: ValidationSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={cn('h-5 w-5', statusColors[status])} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-tint-500 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}
