import { Progress } from '@/components/ui/progress';

interface UploadProgressProps {
  progress: number;
  label?: string;
}

export function UploadProgress({ progress, label }: UploadProgressProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-sm font-medium text-foreground">{Math.round(progress)}%</span>
        </div>
      )}
      <Progress value={progress} className="h-2" />
    </div>
  );
}
