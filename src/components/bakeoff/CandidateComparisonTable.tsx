'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Crown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import type { ModelVersion } from '@/lib/db/types';

interface CandidateComparisonTableProps {
  candidates: ModelVersion[];
  championVersionId: string | null;
}

type SortKey =
  | 'algorithm'
  | 'prAuc'
  | 'recallAtReviewRate'
  | 'precisionAtReviewRate'
  | 'f1'
  | 'stability'
  | 'explainability';

type SortDirection = 'asc' | 'desc';

const METRIC_COLUMNS: {
  key: SortKey;
  label: string;
  isPercentage: boolean;
}[] = [
  { key: 'prAuc', label: 'PR-AUC', isPercentage: false },
  { key: 'recallAtReviewRate', label: 'Recall@RR', isPercentage: false },
  { key: 'precisionAtReviewRate', label: 'Precision@RR', isPercentage: false },
  { key: 'f1', label: 'F1', isPercentage: false },
  { key: 'stability', label: 'Stability', isPercentage: false },
  { key: 'explainability', label: 'Explain.', isPercentage: false },
];

function formatMetric(value: number): string {
  return value.toFixed(4);
}

function getAlgorithmDisplayName(algorithm: string): string {
  const names: Record<string, string> = {
    log_reg: 'Logistic Regression',
    decision_tree: 'Decision Tree',
    random_forest: 'Random Forest',
    extra_trees: 'Extra Trees',
    gradient_boosted: 'Gradient Boosted',
  };
  return names[algorithm] ?? algorithm;
}

export function CandidateComparisonTable({
  candidates,
  championVersionId,
}: CandidateComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('prAuc');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  }

  const sorted = useMemo(() => {
    const copy = [...candidates];
    copy.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortKey === 'algorithm') {
        aVal = a.algorithm;
        bVal = b.algorithm;
      } else {
        aVal = a.metrics_json[sortKey] ?? 0;
        bVal = b.metrics_json[sortKey] ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return copy;
  }, [candidates, sortKey, sortDirection]);

  // Find best value for each metric to highlight
  const bestValues = useMemo(() => {
    const best: Record<string, number> = {};
    for (const col of METRIC_COLUMNS) {
      let max = -Infinity;
      for (const c of candidates) {
        const val = c.metrics_json[col.key as keyof typeof c.metrics_json] ?? 0;
        if (typeof val === 'number' && val > max) max = val;
      }
      best[col.key] = max;
    }
    return best;
  }, [candidates]);

  const sortIcon = (columnKey: SortKey) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="text-muted-foreground ml-1 inline h-3 w-3" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="text-crowe-indigo ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="text-crowe-indigo ml-1 inline h-3 w-3" />
    );
  };

  return (
    <StaggerChildren className="space-y-0">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('algorithm')}
              >
                Algorithm
                {sortIcon('algorithm')}
              </TableHead>
              {METRIC_COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="cursor-pointer text-right select-none"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortIcon(col.key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((candidate) => {
              const isChampion = candidate.id === championVersionId;
              return (
                <TableRow
                  key={candidate.id}
                  className={cn({
                    'bg-crowe-amber/5 hover:bg-crowe-amber/10': isChampion,
                  })}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isChampion && <Crown className="text-crowe-amber-dark h-4 w-4 shrink-0" />}
                      <span className="font-medium">
                        {getAlgorithmDisplayName(candidate.algorithm)}
                      </span>
                      {isChampion && (
                        <Badge className="bg-crowe-amber text-crowe-indigo-dark border-crowe-amber text-[10px]">
                          Champion
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {METRIC_COLUMNS.map((col) => {
                    const val =
                      candidate.metrics_json[col.key as keyof typeof candidate.metrics_json] ?? 0;
                    const numVal = typeof val === 'number' ? val : 0;
                    const isBest = numVal > 0 && numVal === bestValues[col.key];

                    return (
                      <TableCell key={col.key} className="text-right tabular-nums">
                        <span
                          className={cn('text-sm', {
                            'text-crowe-indigo-dark font-semibold': isBest,
                            'text-foreground': !isBest,
                          })}
                        >
                          {formatMetric(numVal)}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </StaggerChildren>
  );
}
