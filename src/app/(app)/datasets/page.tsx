'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { DataTable } from '@/components/tables/DataTable';
import { DatasetRoleChip } from '@/components/datasets/DatasetRoleChip';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';
import type { Dataset, DatasetRole } from '@/lib/db/types';
import { formatDate, formatNumber } from '@/lib/utils/index';
import { Database, AlertTriangle, Upload } from 'lucide-react';
import Link from 'next/link';

const ROLE_FILTERS: Array<{ label: string; value: DatasetRole | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Uploaded', value: 'uploaded' },
  { label: 'Training', value: 'training' },
  { label: 'Scoring', value: 'scoring' },
];

const datasetColumns: ColumnDef<Dataset>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="block max-w-[250px] truncate font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: 'dataset_role',
    header: 'Role',
    cell: ({ row }) => <DatasetRoleChip role={row.original.dataset_role} />,
  },
  {
    accessorKey: 'row_count',
    header: () => <div className="text-right">Rows</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">{formatNumber(row.original.row_count, 0)}</div>
    ),
  },
  {
    accessorKey: 'source_format',
    header: 'Format',
    cell: ({ row }) => (
      <Badge variant="outline" className="text-[10px]">
        {row.original.source_format.toUpperCase()}
      </Badge>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{formatDate(row.original.created_at)}</span>
    ),
  },
];

export default function DatasetsPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DatasetRole | 'all'>('all');

  const fetchDatasets = useCallback(async (role: DatasetRole | 'all') => {
    setLoading(true);
    setError(null);
    try {
      const query = role === 'all' ? '' : `?role=${role}`;
      const res = await fetch(`/api/datasets/list${query}`);
      if (!res.ok) throw new Error('Failed to fetch datasets');
      const data = await res.json();
      setDatasets(data.datasets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets(activeFilter);
  }, [activeFilter, fetchDatasets]);

  function handleFilterChange(role: DatasetRole | 'all') {
    setActiveFilter(role);
  }

  function handleRowClick(dataset: Dataset) {
    router.push(`/datasets/${dataset.id}`);
  }

  return (
    <PageContainer>
      <FadeIn>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
                <Database className="text-crowe-indigo h-6 w-6" />
                Datasets
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Browse and manage all uploaded, training, and scoring datasets.
              </p>
            </div>
            <Link href="/upload">
              <Button className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2">
                <Upload className="h-4 w-4" />
                Upload Dataset
              </Button>
            </Link>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2">
            {ROLE_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={activeFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange(filter.value)}
                className={
                  activeFilter === filter.value
                    ? 'bg-crowe-indigo-dark hover:bg-crowe-indigo text-white'
                    : ''
                }
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* Loading */}
          {loading && <TableSkeleton rows={5} columns={5} />}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <AlertTriangle className="text-crowe-coral h-8 w-8" />
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && datasets.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Database className="text-tint-300 h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                {activeFilter === 'all' ? 'No datasets yet.' : `No ${activeFilter} datasets found.`}
              </p>
              <Link href="/upload">
                <Button variant="outline">Upload your first dataset</Button>
              </Link>
            </div>
          )}

          {/* Table */}
          {!loading && !error && datasets.length > 0 && (
            <DataTable columns={datasetColumns} data={datasets} onRowClick={handleRowClick} />
          )}
        </div>
      </FadeIn>
    </PageContainer>
  );
}
