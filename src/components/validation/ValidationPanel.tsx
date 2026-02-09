'use client';

import type { ValidationResult } from '@/lib/db/types';
import { ValidationSection } from './ValidationSection';
import { MissingnessBar } from './MissingnessBar';
import { DuplicatesList } from './DuplicatesList';
import { TypeMismatchList } from './TypeMismatchList';
import { CheckCircle, AlertTriangle, XCircle, ListChecks } from 'lucide-react';

interface ValidationPanelProps {
  validation: ValidationResult;
}

export function ValidationPanel({ validation }: ValidationPanelProps) {
  const hasMissing = validation.requiredColumns.missing.length > 0;
  const hasMismatches = validation.types.mismatched.length > 0;
  const hasDuplicates = Object.keys(validation.duplicates).length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-crowe-indigo" />
        Structure &amp; Data Quality
      </h3>

      <ValidationSection
        title="Required Columns"
        status={hasMissing ? 'fail' : 'pass'}
        icon={hasMissing ? XCircle : CheckCircle}
        defaultOpen
      >
        <div className="space-y-2">
          {validation.requiredColumns.present.map((col) => (
            <div key={col} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-crowe-teal" />
              <span>{col}</span>
            </div>
          ))}
          {validation.requiredColumns.missing.map((col) => (
            <div key={col} className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-crowe-coral" />
              <span className="text-crowe-coral">{col} — missing</span>
            </div>
          ))}
        </div>
      </ValidationSection>

      {hasMismatches && (
        <ValidationSection
          title="Type Mismatches"
          status="warn"
          icon={AlertTriangle}
        >
          <TypeMismatchList mismatches={validation.types.mismatched} />
        </ValidationSection>
      )}

      <ValidationSection
        title="Missingness"
        status={Object.values(validation.missingness).some((v) => v > 0.1) ? 'warn' : 'pass'}
        icon={Object.values(validation.missingness).some((v) => v > 0.1) ? AlertTriangle : CheckCircle}
      >
        <div className="space-y-2">
          {Object.entries(validation.missingness).map(([col, pct]) => (
            <MissingnessBar key={col} column={col} percentage={pct} />
          ))}
        </div>
      </ValidationSection>

      {hasDuplicates && (
        <ValidationSection
          title="Duplicates"
          status="warn"
          icon={AlertTriangle}
        >
          <DuplicatesList duplicates={validation.duplicates} />
        </ValidationSection>
      )}

      {validation.notes.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-2">Notes</h4>
          <ul className="space-y-1">
            {validation.notes.map((note, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
