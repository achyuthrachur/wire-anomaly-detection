'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RunWithDataset } from '@/lib/db/types';
import { DataTable } from './DataTable';
import { runsColumns } from './columns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RunsTableProps {
  runs: RunWithDataset[];
}

const FILTERS = ['all', 'created', 'validated', 'failed'] as const;

export function RunsTable({ runs }: RunsTableProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? runs : runs.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            className={cn('text-xs capitalize', filter === f && 'bg-crowe-indigo-dark')}
            onClick={() => setFilter(f)}
          >
            {f}
            {f !== 'all' && (
              <span className="ml-1.5 opacity-60">
                ({runs.filter((r) => r.status === f).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      <DataTable
        columns={runsColumns}
        data={filtered}
        onRowClick={(row) => router.push(`/runs/${row.id}`)}
      />
    </div>
  );
}
