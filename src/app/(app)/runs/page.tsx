'use client';

import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { RunsTable } from '@/components/tables/RunsTable';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import type { RunWithDataset } from '@/lib/db/types';
import Link from 'next/link';
import { Upload, AlertTriangle } from 'lucide-react';

export default function RunsPage() {
  const [runs, setRuns] = useState<RunWithDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch('/api/runs/list');
        if (!res.ok) throw new Error('Failed to fetch runs');
        const data = await res.json();
        setRuns(data.runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runs');
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();
  }, []);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Run History</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All dataset uploads and their validation results.
            </p>
          </div>
          <Link href="/upload">
            <Button className="gap-2 bg-crowe-indigo-dark hover:bg-crowe-indigo">
              <Upload className="h-4 w-4" />
              New Upload
            </Button>
          </Link>
        </div>

        {loading && <TableSkeleton rows={5} columns={4} />}

        {error && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-crowe-coral" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">No runs yet.</p>
            <Link href="/upload">
              <Button variant="outline">Upload your first dataset</Button>
            </Link>
          </div>
        )}

        {!loading && !error && runs.length > 0 && <RunsTable runs={runs} />}
      </div>
    </PageContainer>
  );
}
