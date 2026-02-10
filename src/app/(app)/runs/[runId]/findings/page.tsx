'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { FindingsKPIBar } from '@/components/findings/FindingsKPIBar';
import { ScoreBadge } from '@/components/findings/ScoreBadge';
import { ReasonCodeChips } from '@/components/findings/ReasonCodeChips';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Search,
  BarChart3,
  Download,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatNumber, formatDate } from '@/lib/utils/index';
import { cn } from '@/lib/utils';

interface ReasonCodeEntry {
  code: string;
  description: string;
  contribution: 'high' | 'medium' | 'low';
}

interface FindingRow {
  wireId: string;
  rank: number;
  score: number;
  predictedLabel: boolean;
  reasonCodes: ReasonCodeEntry[];
}

interface ScoringsSummary {
  reviewRate?: number;
  thresholdUsed?: number;
  flaggedCount?: number;
  rowCount?: number;
  metricsIfLabelsPresent?: {
    precision: number;
    recall: number;
    f1: number;
  } | null;
}

const PAGE_SIZE = 50;

export default function FindingsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);

  const [summary, setSummary] = useState<ScoringsSummary | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);

  // Fetch run summary
  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) throw new Error('Run not found');
        const data = await res.json();
        setSummary(data.run.summary_json ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run');
      }
    }
    fetchSummary();
  }, [runId]);

  // Fetch findings
  const fetchFindings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/findings?offset=${offset}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error('Failed to load findings');
      const data = await res.json();
      setFindings(data.findings ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load findings');
    } finally {
      setLoading(false);
    }
  }, [runId, offset]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      // Paginate through all findings
      const allRows: FindingRow[] = [];
      let exportOffset = 0;
      const batchSize = 200;
      while (true) {
        const res = await fetch(
          `/api/runs/${runId}/findings?offset=${exportOffset}&limit=${batchSize}`
        );
        if (!res.ok) break;
        const data = await res.json();
        const batch: FindingRow[] = data.findings ?? [];
        allRows.push(...batch);
        if (batch.length < batchSize) break;
        exportOffset += batchSize;
      }

      // Build CSV
      const header = 'Rank,Wire ID,Score,Predicted Label,Reason Codes\n';
      const rows = allRows.map((f) => {
        const reasons = (f.reasonCodes ?? []).map((r) => r.code).join('; ');
        return `${f.rank},"${f.wireId}",${f.score.toFixed(6)},${f.predictedLabel},"${reasons}"`;
      });
      const csv = header + rows.join('\n');

      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `findings-${runId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Best effort
    } finally {
      setExporting(false);
    }
  }

  const filteredFindings = searchTerm
    ? findings.filter((f) => f.wireId.toLowerCase().includes(searchTerm.toLowerCase()))
    : findings;

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PageContainer>
      {/* Back link */}
      <div className="mb-6">
        <Link href={`/runs/${runId}`}>
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Run
          </Button>
        </Link>
      </div>

      {/* Header */}
      <FadeIn>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-crowe-indigo-dark text-2xl font-bold">Scoring Findings</h1>
            <p className="text-tint-500 mt-1 text-sm">
              Flagged wire transfers ranked by anomaly score
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportCsv}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export Findings CSV'}
            </Button>
            <Link href={`/runs/${runId}/results`}>
              <Button variant="outline" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                View Performance Report
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="text-crowe-coral h-8 w-8" />
          <p className="text-muted-foreground text-sm">{error}</p>
          <Link href={`/runs/${runId}`}>
            <Button variant="outline">Back to Run</Button>
          </Link>
        </div>
      )}

      {!error && (
        <>
          {/* KPI bar */}
          {summary && (
            <FadeIn delay={100}>
              <FindingsKPIBar summary={summary} className="mb-8" />
            </FadeIn>
          )}

          {/* Search / filter bar */}
          <FadeIn delay={200}>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative max-w-xs flex-1">
                <Search className="text-tint-500 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by Wire ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <span className="text-tint-500 text-sm">{formatNumber(total, 0)} findings total</span>
            </div>
          </FadeIn>

          {/* Findings table */}
          <FadeIn delay={300}>
            <div className="border-border bg-card rounded-xl border">
              {loading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredFindings.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-tint-500 text-sm">
                    {searchTerm
                      ? 'No findings match your search.'
                      : 'No findings generated for this run.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Wire ID</TableHead>
                      <TableHead className="w-48">Score</TableHead>
                      <TableHead>Reason Codes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFindings.map((finding) => (
                      <TableRow key={finding.wireId} className="group">
                        <TableCell className="text-tint-500 font-mono text-xs">
                          #{finding.rank}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/runs/${runId}/findings/${finding.wireId}`}
                            className="text-crowe-indigo hover:text-crowe-amber-dark font-medium underline-offset-2 transition-colors hover:underline"
                          >
                            {finding.wireId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <ScoreBadge score={finding.score} />
                        </TableCell>
                        <TableCell>
                          <ReasonCodeChips codes={finding.reasonCodes ?? []} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </FadeIn>

          {/* Pagination */}
          {totalPages > 1 && (
            <FadeIn delay={400}>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-tint-500 text-sm">
                  Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of{' '}
                  {formatNumber(total, 0)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-tint-700 px-2 text-sm font-medium tabular-nums">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </PageContainer>
  );
}
