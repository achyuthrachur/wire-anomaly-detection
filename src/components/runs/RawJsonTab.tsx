'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import type { ValidationResult, ProfilingResult } from '@/lib/db/types';

interface RawJsonTabProps {
  validation: ValidationResult;
  profiling: ProfilingResult;
}

export function RawJsonTab({ validation, profiling }: RawJsonTabProps) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify({ validation, profiling }, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="absolute top-3 right-3">
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-2">
          {copied ? <Check className="h-4 w-4 text-crowe-teal" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-auto rounded-xl border border-border bg-muted/50 p-6 text-xs font-mono leading-relaxed max-h-[600px]">
        {json}
      </pre>
    </div>
  );
}
