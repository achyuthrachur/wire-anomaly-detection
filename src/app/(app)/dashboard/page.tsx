'use client';

import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { MetricTile } from '@/components/profiling/MetricTile';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/skeletons/CardSkeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { Upload, Trash2 } from 'lucide-react';
import type { RunWithDataset } from '@/lib/db/types';

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunWithDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [datasetCount, setDatasetCount] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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

    async function fetchDatasets() {
      try {
        const res = await fetch('/api/datasets/list');
        if (res.ok) {
          const data = await res.json();
          setDatasetCount(data.datasets?.length ?? 0);
        }
      } catch {
        // silently ignore
      }
    }

    fetchRuns();
    fetchDatasets();
  }, []);

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setResetting(false);
      setResetDialogOpen(false);
    }
  }

  const totalRuns = runs.length;
  const validated = runs.filter((r) => r.status === 'validated').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const scored = runs.filter((r) => r.status === 'scored').length;
  const totalRows = runs.reduce((sum, r) => sum + (r.row_count || 0), 0);

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Overview of wire anomaly detection runs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-crowe-coral gap-2">
                  <Trash2 className="h-4 w-4" />
                  Reset Demo Data
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset all demo data?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete all datasets, models, runs, findings, and synthetic
                    jobs. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setResetDialogOpen(false)}
                    disabled={resetting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-crowe-coral hover:bg-crowe-coral-dark text-white"
                    onClick={handleReset}
                    disabled={resetting}
                  >
                    {resetting ? 'Deleting...' : 'Delete Everything'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Link href="/upload">
              <Button className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2">
                <Upload className="h-4 w-4" />
                New Upload
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile label="Total Runs" value={totalRuns.toString()} />
            <MetricTile label="Validated" value={validated.toString()} />
            <MetricTile label="Scored" value={scored.toString()} />
            <MetricTile label="Failed" value={failed.toString()} />
            <MetricTile label="Total Rows" value={totalRows.toLocaleString()} />
            <MetricTile label="Datasets" value={datasetCount.toString()} />
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="border-border flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <p className="text-muted-foreground text-sm">
              No runs yet. Upload a dataset to get started.
            </p>
            <Link href="/upload">
              <Button variant="outline">Upload Dataset</Button>
            </Link>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
