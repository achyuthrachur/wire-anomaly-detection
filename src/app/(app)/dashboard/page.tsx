'use client';

import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { MetricTile } from '@/components/profiling/MetricTile';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/skeletons/CardSkeleton';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import type { RunWithDataset } from '@/lib/db/types';

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunWithDataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch('/api/runs/list');
        if (res.ok) {
          const data = await res.json();
          setRuns(data.runs);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();
  }, []);

  const totalRuns = runs.length;
  const validated = runs.filter((r) => r.status === 'validated').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const totalRows = runs.reduce((sum, r) => sum + (r.row_count || 0), 0);

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Overview of wire anomaly detection runs.
            </p>
          </div>
          <Link href="/upload">
            <Button className="gap-2 bg-crowe-indigo-dark hover:bg-crowe-indigo">
              <Upload className="h-4 w-4" />
              New Upload
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Total Runs" value={totalRuns.toString()} />
            <MetricTile label="Validated" value={validated.toString()} />
            <MetricTile label="Failed" value={failed.toString()} />
            <MetricTile label="Total Rows" value={totalRows.toLocaleString()} />
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">No runs yet. Upload a dataset to get started.</p>
            <Link href="/upload">
              <Button variant="outline">Upload Dataset</Button>
            </Link>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
