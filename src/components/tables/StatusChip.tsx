import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type RunStatus = 'created' | 'validated' | 'failed';

interface StatusChipProps {
  status: RunStatus;
}

const statusConfig: Record<RunStatus, { label: string; className: string }> = {
  created: {
    label: 'Created',
    className: 'bg-crowe-indigo-dark/10 text-crowe-indigo-dark border-crowe-indigo-dark/20',
  },
  validated: {
    label: 'Validated',
    className: 'bg-crowe-teal/10 text-crowe-teal-dark border-crowe-teal/20',
  },
  failed: {
    label: 'Failed',
    className: 'bg-crowe-coral/10 text-crowe-coral-dark border-crowe-coral/20',
  },
};

export function StatusChip({ status }: StatusChipProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
