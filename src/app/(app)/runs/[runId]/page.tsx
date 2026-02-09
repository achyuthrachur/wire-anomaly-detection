'use client';

import { useEffect, useState, use } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { RunDetail } from '@/components/runs/RunDetail';
import { DetailSkeleton } from '@/components/skeletons/DetailSkeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRun() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) throw new Error('Run not found');
        const data = await res.json();
        setRun(data.run);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run');
      } finally {
        setLoading(false);
      }
    }
    fetchRun();
  }, [runId]);

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/runs">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Runs
          </Button>
        </Link>
      </div>

      {loading && <DetailSkeleton />}

      {error && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-crowe-coral" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/runs">
            <Button variant="outline">Back to Runs</Button>
          </Link>
        </div>
      )}

      {!loading && !error && run && <RunDetail run={run} />}
    </PageContainer>
  );
}
