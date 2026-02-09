'use client';

import { Badge } from '@/components/ui/badge';
import type { InferredSchema } from '@/lib/db/types';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import { Columns3 } from 'lucide-react';

interface SchemaTabProps {
  schema: InferredSchema;
}

const typeColorMap: Record<string, string> = {
  string: 'bg-crowe-indigo-dark/10 text-crowe-indigo-dark border-crowe-indigo-dark/20',
  number: 'bg-crowe-blue/10 text-crowe-blue-dark border-crowe-blue-dark/20',
  integer: 'bg-crowe-blue/10 text-crowe-blue-dark border-crowe-blue-dark/20',
  boolean: 'bg-crowe-violet/10 text-crowe-violet-dark border-crowe-violet-dark/20',
  date: 'bg-crowe-teal/10 text-crowe-teal-dark border-crowe-teal/20',
  currency: 'bg-crowe-amber/10 text-crowe-amber-dark border-crowe-amber-dark/20',
  categorical: 'bg-crowe-cyan/10 text-crowe-cyan-dark border-crowe-cyan-dark/20',
};

export function SchemaTab({ schema }: SchemaTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
        <Columns3 className="text-crowe-indigo h-5 w-5" />
        Column Schema
      </h3>
      <p className="text-muted-foreground text-sm">
        {schema.columns.length} columns inferred from the uploaded data.
      </p>

      <StaggerChildren className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" delay={50}>
        {schema.columns.map((col) => (
          <div key={col.name} className="border-border bg-card space-y-2.5 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground text-sm font-semibold break-all">{col.name}</p>
              <div className="flex shrink-0 gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium ${typeColorMap[col.type] ?? typeColorMap.string}`}
                >
                  {col.type}
                </Badge>
                {col.nullable && (
                  <Badge
                    variant="outline"
                    className="bg-tint-100/50 text-tint-700 border-tint-300/50 text-[10px] font-medium"
                  >
                    nullable
                  </Badge>
                )}
              </div>
            </div>

            {col.sampleValues.length > 0 && (
              <p className="text-muted-foreground truncate text-xs leading-relaxed">
                <span className="text-tint-500">Samples:</span> {col.sampleValues.join(', ')}
              </p>
            )}
          </div>
        ))}
      </StaggerChildren>
    </div>
  );
}
