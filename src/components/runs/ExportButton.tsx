'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { ValidationResult, ProfilingResult, ScoringsSummary } from '@/lib/db/types';

interface ExportButtonProps {
  validation?: ValidationResult | null;
  profiling?: ProfilingResult | null;
  summary?: ScoringsSummary | null;
  datasetName: string;
}

export function ExportButton({ validation, profiling, summary, datasetName }: ExportButtonProps) {
  const handleExport = () => {
    const exportData: Record<string, unknown> = {};
    if (validation) exportData.validation = validation;
    if (profiling) exportData.profiling = profiling;
    if (summary) exportData.scoringSummary = summary;

    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetName.replace(/\.[^.]+$/, '')}_results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      Export JSON
    </Button>
  );
}
