'use client';

import { useCallback, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Upload, FileSpreadsheet, Shield } from 'lucide-react';

interface HeroUploadCardProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function HeroUploadCard({ onFileSelect, disabled }: HeroUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const validExtensions = ['.csv', '.xlsx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return 'Please upload a CSV or Excel (.xlsx) file.';
    }
    const maxSizeBytes = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSizeBytes) {
      return 'File size must be 50 MB or less.';
    }
    return null;
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        const error = validateFile(file);
        if (error) {
          setValidationError(error);
          return;
        }
        setValidationError(null);
        onFileSelect(file);
      }
    },
    [disabled, onFileSelect]
  );

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      setValidationError(null);
      onFileSelect(file);
    }
  };

  return (
    <Card
      className={cn(
        'relative cursor-pointer overflow-hidden border-2 border-dashed p-12 text-center transition-all duration-200',
        isDragging
          ? 'border-crowe-amber bg-crowe-amber/5 shadow-lg'
          : 'border-tint-300 hover:border-crowe-indigo hover:bg-muted/50',
        disabled && 'pointer-events-none opacity-60'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-6">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-200',
            isDragging ? 'bg-crowe-amber/20 scale-110' : 'bg-crowe-indigo-dark/5'
          )}
        >
          <Upload
            className={cn(
              'h-10 w-10 transition-colors',
              isDragging ? 'text-crowe-amber' : 'text-crowe-indigo-dark'
            )}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-foreground text-2xl font-semibold">Upload a Wire Dataset</h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            We&apos;ll validate structure, profile key fields, and prepare the run for anomaly
            detection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <FileSpreadsheet className="h-3 w-3" />
            CSV
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <FileSpreadsheet className="h-3 w-3" />
            XLSX
          </Badge>
          <span className="text-tint-500 text-xs">up to 50 MB</span>
        </div>

        <Button variant="outline" size="lg" className="mt-2" disabled={disabled}>
          Choose File
        </Button>

        {validationError && (
          <p className="mt-2 text-sm font-medium text-red-600">{validationError}</p>
        )}

        <div className="text-tint-500 flex items-center gap-2 text-xs">
          <Shield className="h-3.5 w-3.5" />
          <span>Use synthetic demo data only. No customer PII required.</span>
        </div>
      </div>
    </Card>
  );
}
