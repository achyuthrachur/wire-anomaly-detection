'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Loader2 } from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  champion_version_id: string | null;
  champion_algorithm: string | null;
}

interface StartScoringDialogProps {
  datasetId: string;
  onStarted: (runId: string) => void;
}

export function StartScoringDialog({ datasetId, onStarted }: StartScoringDialogProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [reviewRate, setReviewRate] = useState('0.005');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingModels(true);
    setError(null);

    fetch('/api/models/list')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load models');
        return res.json();
      })
      .then((data) => {
        setModels(data.models ?? []);
        if (data.models?.length > 0 && !selectedModelId) {
          setSelectedModelId(data.models[0].id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load models');
      })
      .finally(() => setLoadingModels(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleStart() {
    if (!selectedModelId) {
      setError('Please select a model.');
      return;
    }

    const parsedRate = parseFloat(reviewRate);
    if (isNaN(parsedRate) || parsedRate <= 0 || parsedRate > 1) {
      setError('Review rate must be between 0.0001 and 1.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/score/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          modelId: selectedModelId,
          reviewRate: parsedRate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to start scoring');
      }

      const data = await res.json();
      setOpen(false);
      onStarted(data.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scoring');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Play className="h-4 w-4" />
          Start Scoring
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Scoring Run</DialogTitle>
          <DialogDescription>
            Score this dataset against a trained model to identify anomalous wire transfers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Model Selector */}
          <div className="space-y-2">
            <Label htmlFor="scoring-model">Model</Label>
            {loadingModels ? (
              <div className="text-tint-500 flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading models...
              </div>
            ) : models.length === 0 ? (
              <p className="text-tint-500 text-sm">No models found. Train a model first.</p>
            ) : (
              <select
                id="scoring-model"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.champion_algorithm ? ` (${m.champion_algorithm})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Review Rate */}
          <div className="space-y-2">
            <Label htmlFor="scoring-review-rate">Review Rate</Label>
            <Input
              id="scoring-review-rate"
              type="number"
              step="0.001"
              min="0.0001"
              max="1"
              value={reviewRate}
              onChange={(e) => setReviewRate(e.target.value)}
              placeholder="0.005"
            />
            <p className="text-tint-500 text-xs">
              Fraction of transactions to flag for review (e.g. 0.005 = top 0.5%).
            </p>
          </div>

          {error && <p className="text-crowe-coral text-sm font-medium">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={submitting || loadingModels || models.length === 0}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Starting...' : 'Start Scoring'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
