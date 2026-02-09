'use client';

import { FadeIn } from '@/components/motion/FadeIn';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/index';

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

interface FindingsKPIBarProps {
  summary: ScoringsSummary;
  className?: string;
}

interface KPIItem {
  label: string;
  value: string;
}

export function FindingsKPIBar({ summary, className }: FindingsKPIBarProps) {
  const kpis: KPIItem[] = [];

  if (summary.flaggedCount != null) {
    kpis.push({
      label: 'Flagged Wires',
      value: formatNumber(summary.flaggedCount, 0),
    });
  }

  if (summary.reviewRate != null) {
    kpis.push({
      label: 'Review Rate',
      value: `${(summary.reviewRate * 100).toFixed(2)}%`,
    });
  }

  if (summary.thresholdUsed != null) {
    kpis.push({
      label: 'Threshold',
      value: summary.thresholdUsed.toFixed(4),
    });
  }

  if (summary.rowCount != null) {
    kpis.push({
      label: 'Total Rows',
      value: formatNumber(summary.rowCount, 0),
    });
  }

  if (summary.metricsIfLabelsPresent) {
    const m = summary.metricsIfLabelsPresent;
    kpis.push({
      label: 'Precision',
      value: `${(m.precision * 100).toFixed(1)}%`,
    });
    kpis.push({
      label: 'Recall',
      value: `${(m.recall * 100).toFixed(1)}%`,
    });
    kpis.push({
      label: 'F1 Score',
      value: m.f1.toFixed(3),
    });
  }

  return (
    <div
      className={cn(
        'grid gap-4',
        kpis.length <= 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
        className
      )}
    >
      {kpis.map((kpi, i) => (
        <FadeIn key={kpi.label} delay={i * 80} direction="up">
          <div className="border-border bg-card rounded-xl border p-4">
            <p className="text-tint-500 text-xs font-medium">{kpi.label}</p>
            <p className="text-crowe-indigo-dark mt-1 text-2xl font-semibold tabular-nums">
              {kpi.value}
            </p>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
