'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DatasetRole } from '@/lib/db/types';

interface DatasetRoleChipProps {
  role: DatasetRole;
}

const roleConfig: Record<DatasetRole, { label: string; className: string }> = {
  uploaded: {
    label: 'Uploaded',
    className: 'bg-crowe-indigo-dark/10 text-crowe-indigo-dark border-crowe-indigo-dark/20',
  },
  training: {
    label: 'Training',
    className: 'bg-crowe-teal/10 text-crowe-teal-dark border-crowe-teal/20',
  },
  scoring: {
    label: 'Scoring',
    className: 'bg-crowe-amber/10 text-crowe-amber-dark border-crowe-amber-dark/20',
  },
};

export function DatasetRoleChip({ role }: DatasetRoleChipProps) {
  const config = roleConfig[role];
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
