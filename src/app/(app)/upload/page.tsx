'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/PageContainer';
import { HeroUploadCard } from '@/components/upload/HeroUploadCard';
import { ProgressStepper, type StepStatus } from '@/components/upload/ProgressStepper';
import { FilePreview } from '@/components/upload/FilePreview';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ProfilingCards } from '@/components/profiling/ProfilingCards';
import { Button } from '@/components/ui/button';
import type { ValidationResult, ProfilingResult, InferredSchema } from '@/lib/db/types';
import { ArrowRight, RotateCcw } from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'validating' | 'complete' | 'failed';

interface UploadResult {
  datasetId: string;
  runId: string;
  blobUrl: string;
  schema: InferredSchema;
}

interface ValidateResult {
  status: string;
  validation: ValidationResult;
  profiling: ProfilingResult;
}

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);

  const getSteps = (): { label: string; status: StepStatus }[] => {
    const steps: { label: string; status: StepStatus }[] = [
      { label: 'Upload', status: 'pending' },
      { label: 'Validate', status: 'pending' },
      { label: 'Profile', status: 'pending' },
      { label: 'Done', status: 'pending' },
    ];

    if (state === 'uploading') {
      steps[0].status = 'active';
    } else if (state === 'validating') {
      steps[0].status = 'complete';
      steps[1].status = 'active';
      steps[2].status = 'active';
    } else if (state === 'complete') {
      steps[0].status = 'complete';
      steps[1].status = 'complete';
      steps[2].status = 'complete';
      steps[3].status = 'complete';
    } else if (state === 'failed') {
      steps[0].status = 'complete';
      steps[1].status = 'error';
    }

    return steps;
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setState('uploading');
    setProgress(0);

    try {
      // Upload
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simulate progress since fetch doesn't support progress natively
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 200);

      const uploadRes = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const uploadData: UploadResult = await uploadRes.json();
      setUploadResult(uploadData);
      toast.success('File uploaded successfully');

      // Validate + Profile
      setState('validating');

      const validateRes = await fetch('/api/datasets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: uploadData.datasetId,
          runId: uploadData.runId,
        }),
      });

      if (!validateRes.ok) {
        const err = await validateRes.json();
        throw new Error(err.error || 'Validation failed');
      }

      const validateData: ValidateResult = await validateRes.json();
      setValidateResult(validateData);

      if (validateData.status === 'failed') {
        setState('failed');
        toast.error('Validation failed — required columns missing');
      } else {
        setState('complete');
        toast.success('Validation and profiling complete');
      }
    } catch (error) {
      setState('failed');
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  }, []);

  const handleReset = () => {
    setState('idle');
    setFile(null);
    setProgress(0);
    setUploadResult(null);
    setValidateResult(null);
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Stepper */}
        {state !== 'idle' && (
          <ProgressStepper steps={getSteps()} />
        )}

        {/* Upload zone */}
        {state === 'idle' && (
          <HeroUploadCard onFileSelect={handleFileSelect} />
        )}

        {/* File preview + progress */}
        {file && state === 'uploading' && (
          <div className="space-y-4">
            <FilePreview file={file} />
            <UploadProgress progress={progress} label="Uploading file..." />
          </div>
        )}

        {/* Validating state */}
        {state === 'validating' && file && (
          <div className="space-y-4">
            <FilePreview file={file} />
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-crowe-amber border-t-transparent" />
                Running validation and profiling...
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {(state === 'complete' || state === 'failed') && validateResult && (
          <div className="space-y-8">
            {file && <FilePreview file={file} />}

            <ValidationPanel validation={validateResult.validation} />

            {state === 'complete' && (
              <ProfilingCards profiling={validateResult.profiling} />
            )}

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Upload Another
              </Button>
              {uploadResult && (
                <Button
                  onClick={() => router.push(`/runs/${uploadResult.runId}`)}
                  className="gap-2 bg-crowe-indigo-dark hover:bg-crowe-indigo"
                >
                  View Run Details
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
