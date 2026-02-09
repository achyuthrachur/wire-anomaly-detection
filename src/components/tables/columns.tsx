'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { RunWithDataset } from '@/lib/db/types';
import { StatusChip } from './StatusChip';
import { formatDate } from '@/lib/utils/index';
import { Badge } from '@/components/ui/badge';

export const runsColumns: ColumnDef<RunWithDataset>[] = [
  {
    accessorKey: 'dataset_name',
    header: 'Dataset',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium truncate max-w-[200px]">
          {row.original.dataset_name}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {row.original.source_format.toUpperCase()}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusChip status={row.original.status} />,
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true;
      return row.original.status === filterValue;
    },
  },
  {
    accessorKey: 'row_count',
    header: () => <div className="text-right">Rows</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">
        {row.original.row_count.toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
];
