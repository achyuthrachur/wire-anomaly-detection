import type { RunWithDataset, InferredSchema } from '@/lib/db/types';
import { MetricTile } from '@/components/profiling/MetricTile';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/index';

interface SummaryTabProps {
  run: RunWithDataset & { schema_json: InferredSchema };
}

export function SummaryTab({ run }: SummaryTabProps) {
  const schema = run.schema_json as InferredSchema;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <MetricTile label="Dataset" value={run.dataset_name} />
        <MetricTile label="Format" value={run.source_format.toUpperCase()} />
        <MetricTile label="Rows" value={run.row_count.toLocaleString()} />
        <MetricTile label="Created" value={formatDate(run.created_at)} />
      </div>

      {schema?.columns && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Schema ({schema.columns.length} columns)</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {schema.columns.map((col) => (
              <div key={col.name} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
                <span className="text-sm font-medium truncate">{col.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                  {col.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
