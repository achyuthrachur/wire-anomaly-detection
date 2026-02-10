'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, AlertCircle, Upload, Database } from 'lucide-react';
import type { Dataset } from '@/lib/db/types';

interface ScoreDataDialogProps {
  modelId: string;
  modelName: string;
  championVersionId: string;
}

type Mode = 'upload' | 'existing';

export function ScoreDataDialog({ modelId, modelName, championVersionId }: ScoreDataDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [reviewRate, setReviewRate] = useState('0.005');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // Fetch scoring datasets when dialog opens in existing mode
  useEffect(() => {
    if (!open) return;
    setLoadingDatasets(true);
    async function fetchDatasets() {
      try {
        const res = await fetch('/api/datasets/list?role=scoring');
        if (res.ok) {
          const data = await res.json();
          const list = data.datasets ?? [];
          setDatasets(list);
          if (list.length > 0 && !selectedDatasetId) {
            setSelectedDatasetId(list[0].id);
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoadingDatasets(false);
      }
    }
    fetchDatasets();
  }, [open, selectedDatasetId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rr = parseFloat(reviewRate);
    if (isNaN(rr) || rr <= 0 || rr > 1) {
      setError('Review rate must be between 0 and 1.');
      return;
    }

    setSubmitting(true);

    try {
      let datasetId = selectedDatasetId;

      // Upload file first if in upload mode
      if (mode === 'upload') {
        if (!file) {
          setError('Select a file to upload.');
          setSubmitting(false);
          return;
        }

        setStatus('Uploading...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('role', 'scoring');

        const uploadRes = await fetch('/api/datasets/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error || 'Upload failed');
        }

        const uploadData = await uploadRes.json();
        datasetId = uploadData.datasetId;
      }

      if (!datasetId) {
        setError('No dataset selected.');
        setSubmitting(false);
        return;
      }

      // Start scoring
      setStatus('Scoring...');
      const scoreRes = await fetch('/api/score/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          modelId,
          modelVersionId: championVersionId,
          reviewRate: rr,
        }),
      });

      if (!scoreRes.ok) {
        const data = await scoreRes.json();
        throw new Error(data.error || 'Scoring failed');
      }

      const scoreData = await scoreRes.json();
      setOpen(false);
      router.push(`/runs/${scoreData.runId}/results`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
      setStatus('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-crowe-teal hover:bg-crowe-teal-dark gap-2 text-white">
          <Play className="h-4 w-4" />
          Score New Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Score New Data</DialogTitle>
          <DialogDescription>
            Score a dataset using the champion model from{' '}
            <span className="text-foreground font-medium">{modelName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'upload'
                  ? 'border-crowe-indigo bg-crowe-indigo/5 text-crowe-indigo-dark'
                  : 'border-input text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload New File
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'existing'
                  ? 'border-crowe-indigo bg-crowe-indigo/5 text-crowe-indigo-dark'
                  : 'border-input text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Database className="h-4 w-4" />
              Select Existing
            </button>
          </div>

          {/* Upload mode */}
          {mode === 'upload' && (
            <div className="space-y-2">
              <label htmlFor="score-file" className="text-foreground text-sm font-medium">
                Dataset File <span className="text-crowe-coral">*</span>
              </label>
              <input
                id="score-file"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="border-input bg-background text-foreground file:bg-crowe-indigo-dark flex h-10 w-full rounded-md border px-3 py-1.5 text-sm transition-colors file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1 file:text-sm file:text-white"
              />
              <p className="text-muted-foreground text-xs">CSV or XLSX, max 50MB.</p>
            </div>
          )}

          {/* Existing mode */}
          {mode === 'existing' && (
            <div className="space-y-2">
              <label htmlFor="score-dataset" className="text-foreground text-sm font-medium">
                Scoring Dataset <span className="text-crowe-coral">*</span>
              </label>
              {loadingDatasets ? (
                <div className="text-muted-foreground text-sm">Loading datasets...</div>
              ) : datasets.length === 0 ? (
                <div className="bg-crowe-amber/5 border-crowe-amber/20 rounded-md border p-3 text-sm">
                  <p className="text-foreground font-medium">No scoring datasets available</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Upload a file or switch to &ldquo;Upload New File&rdquo; mode.
                  </p>
                </div>
              ) : (
                <select
                  id="score-dataset"
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="border-input bg-background text-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.row_count.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Review rate */}
          <div className="space-y-2">
            <label htmlFor="score-review-rate" className="text-foreground text-sm font-medium">
              Review Rate
            </label>
            <input
              id="score-review-rate"
              type="number"
              step="0.001"
              min="0.0001"
              max="1"
              value={reviewRate}
              onChange={(e) => setReviewRate(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            />
            <p className="text-muted-foreground text-xs">
              Fraction of transactions reviewed (default: 0.5%).
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-crowe-coral/5 text-crowe-coral flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                (mode === 'upload' && !file) ||
                (mode === 'existing' && !selectedDatasetId)
              }
              className="bg-crowe-teal hover:bg-crowe-teal-dark gap-2 text-white"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {status || 'Processing...'}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Score Data
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
