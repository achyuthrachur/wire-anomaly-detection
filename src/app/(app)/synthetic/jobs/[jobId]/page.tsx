'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  FlaskConical,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (matches the API response shape)
// ---------------------------------------------------------------------------

type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface SyntheticJobResponse {
  job: {
    id: string;
    status: JobStatus;
    trainingDatasetId: string | null;
    scoringDatasetId: string | null;
    config: Record<string, unknown>;
    error: Record<string, unknown> | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
}

// ---------------------------------------------------------------------------
// Polling config (matches bakeoff pattern)
// ---------------------------------------------------------------------------

const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 5000;
const BACKOFF_THRESHOLD_MS = 30_000;

function isPollingStatus(status: JobStatus): boolean {
  return status === 'queued' || status === 'running';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SyntheticJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<SyntheticJobResponse['job'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollStartRef = useRef<number>(Date.now());

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/synthetic/jobs/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Synthetic job not found');
        throw new Error('Failed to fetch job status');
      }
      const data: SyntheticJobResponse = await res.json();
      setJob(data.job);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Initial fetch
  useEffect(() => {
    fetchJob();
    pollStartRef.current = Date.now();
  }, [fetchJob]);

  // Polling while queued / running (fast poll, then slow after 30s)
  useEffect(() => {
    if (!job || !isPollingStatus(job.status)) return;

    const elapsed = Date.now() - pollStartRef.current;
    const interval = elapsed > BACKOFF_THRESHOLD_MS ? SLOW_POLL_MS : FAST_POLL_MS;

    const timer = setTimeout(() => {
      fetchJob();
    }, interval);

    return () => clearTimeout(timer);
  }, [job, fetchJob]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const progressValue = !job
    ? 0
    : job.status === 'completed'
      ? 100
      : job.status === 'running'
        ? 55
        : job.status === 'failed'
          ? 100
          : 10; // queued

  return (
    <PageContainer>
      {/* Back link */}
      <div className="mb-6">
        <Link href="/synthetic">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Synthetic Studio
          </Button>
        </Link>
      </div>

      {/* Loading skeleton */}
      {loading && <JobSkeleton />}

      {/* Fetch error */}
      {error && !loading && (
        <FadeIn>
          <Card className="border-crowe-coral/30">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <XCircle className="text-crowe-coral h-8 w-8" />
              <p className="text-muted-foreground text-sm">{error}</p>
              <Link href="/synthetic">
                <Button variant="outline">Back to Synthetic Studio</Button>
              </Link>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Job loaded */}
      {!loading && !error && job && (
        <div className="space-y-6">
          {/* Header */}
          <FadeIn>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <FlaskConical className="text-crowe-indigo h-6 w-6 shrink-0" />
                <h1 className="text-foreground text-2xl font-semibold">Synthetic Generation</h1>
                <StatusBadge status={job.status} />
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-xs">Job {job.id.slice(0, 8)}...</span>
                <span className="text-tint-300">|</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Created {formatRelativeTime(job.createdAt)}
                </span>
                {job.completedAt && (
                  <>
                    <span className="text-tint-300">|</span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completed {formatRelativeTime(job.completedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Progress Card */}
          <FadeIn delay={100}>
            <Card>
              <CardContent className="py-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <StatusMessage status={job.status} />
                    <span className="text-muted-foreground font-mono text-xs">
                      {progressValue}%
                    </span>
                  </div>
                  <Progress
                    value={progressValue}
                    className={cn(
                      'h-2.5',
                      job.status === 'failed' &&
                        '[&>[data-slot=progress-indicator]]:bg-crowe-coral',
                      job.status === 'completed' &&
                        '[&>[data-slot=progress-indicator]]:bg-crowe-teal'
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Completed: dataset links */}
          {job.status === 'completed' && (
            <FadeIn delay={200}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {job.trainingDatasetId && (
                  <DatasetLink
                    role="Training"
                    datasetId={job.trainingDatasetId}
                    badgeClassName="bg-crowe-indigo-dark/5 text-crowe-indigo-dark border-crowe-indigo-dark/20"
                  />
                )}
                {job.scoringDatasetId && (
                  <DatasetLink
                    role="Scoring"
                    datasetId={job.scoringDatasetId}
                    badgeClassName="bg-crowe-amber/10 text-crowe-amber-dark border-crowe-amber/20"
                  />
                )}
              </div>
            </FadeIn>
          )}

          {/* Failed: error message */}
          {job.status === 'failed' && (
            <FadeIn delay={200}>
              <Card className="border-crowe-coral/30">
                <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="bg-crowe-coral/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <XCircle className="text-crowe-coral h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-semibold">Generation Failed</h2>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm">
                      {job.error && typeof job.error === 'object' && 'message' in job.error
                        ? String(job.error.message)
                        : 'An unexpected error occurred during data generation. Please try again with different parameters.'}
                    </p>
                  </div>
                  <Link href="/synthetic">
                    <Button variant="outline">Try Again</Button>
                  </Link>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Queued / Running: spinner message */}
          {isPollingStatus(job.status) && (
            <FadeIn delay={200}>
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                  <Loader2 className="text-crowe-indigo h-8 w-8 animate-spin" />
                  <div>
                    <h2 className="text-foreground font-semibold">
                      {job.status === 'queued' ? 'Queued for Generation' : 'Generating Datasets...'}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {job.status === 'queued'
                        ? 'Your job is in the queue. Generation will begin shortly.'
                        : 'Creating training and scoring wire transfer datasets. This may take a moment for large volumes.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </div>
      )}
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: JobStatus }) {
  const config: Record<JobStatus, { label: string; className: string }> = {
    queued: {
      label: 'Queued',
      className: 'bg-crowe-cyan/10 text-crowe-cyan-dark border-crowe-cyan/20',
    },
    running: {
      label: 'Running',
      className: 'bg-crowe-blue/10 text-crowe-blue-dark border-crowe-blue/20',
    },
    completed: {
      label: 'Completed',
      className: 'bg-crowe-teal/10 text-crowe-teal-dark border-crowe-teal/20',
    },
    failed: {
      label: 'Failed',
      className: 'bg-crowe-coral/10 text-crowe-coral-dark border-crowe-coral/20',
    },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// StatusMessage
// ---------------------------------------------------------------------------

function StatusMessage({ status }: { status: JobStatus }) {
  switch (status) {
    case 'queued':
      return (
        <span className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          Waiting in queue...
        </span>
      );
    case 'running':
      return (
        <span className="text-crowe-blue flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating wire datasets...
        </span>
      );
    case 'completed':
      return (
        <span className="text-crowe-teal flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Generation complete
        </span>
      );
    case 'failed':
      return (
        <span className="text-crowe-coral flex items-center gap-2 text-sm font-medium">
          <XCircle className="h-4 w-4" />
          Generation failed
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// DatasetLink
// ---------------------------------------------------------------------------

function DatasetLink({
  role,
  datasetId,
  badgeClassName,
}: {
  role: string;
  datasetId: string;
  badgeClassName: string;
}) {
  return (
    <Link href={`/datasets/${datasetId}`}>
      <Card className="group cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 py-5">
          <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Database className="text-crowe-indigo h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', badgeClassName)}>
                {role}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">{datasetId}</p>
          </div>
          <ExternalLink className="text-tint-300 group-hover:text-crowe-indigo h-4 w-4 shrink-0 transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function JobSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
