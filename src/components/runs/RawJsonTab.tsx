'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import type { ValidationResult, ProfilingResult, ScoringsSummary } from '@/lib/db/types';

interface RawJsonTabProps {
  validation: ValidationResult | null;
  profiling: ProfilingResult | null;
  summary?: ScoringsSummary | null;
}

export function RawJsonTab({ validation, profiling, summary }: RawJsonTabProps) {
  const [copied, setCopied] = useState(false);

  const jsonObj: Record<string, unknown> = {};
  if (validation) jsonObj.validation = validation;
  if (profiling) jsonObj.profiling = profiling;
  if (summary) jsonObj.scoringSummary = summary;
  const json = JSON.stringify(jsonObj, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="absolute top-3 right-3">
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-2">
          {copied ? <Check className="text-crowe-teal h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="border-border bg-muted/50 max-h-[600px] overflow-auto rounded-xl border p-6 font-mono text-xs leading-relaxed">
        {json}
      </pre>
    </div>
  );
}
