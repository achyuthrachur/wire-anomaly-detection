import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils/index';

interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const ext = file.name.split('.').pop()?.toUpperCase() ?? '';

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-crowe-indigo-dark/5">
        <FileSpreadsheet className="h-6 w-6 text-crowe-indigo-dark" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {ext}
          </Badge>
        </div>
      </div>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
