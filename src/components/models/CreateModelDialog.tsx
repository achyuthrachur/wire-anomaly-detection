'use client';

import { useState } from 'react';
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
import { Plus } from 'lucide-react';

interface CreateModelDialogProps {
  onCreated: (modelId: string) => void;
}

export function CreateModelDialog({ onCreated }: CreateModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/models/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create model');
      }

      const data = await res.json();
      setName('');
      setDescription('');
      setOpen(false);
      onCreated(data.modelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create model');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2 text-white">
          <Plus className="h-4 w-4" />
          Create Model
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Model</DialogTitle>
          <DialogDescription>
            Register a new model in the model registry. You can add versions and run bake-offs after
            creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="model-name" className="text-foreground text-sm font-medium">
              Model Name <span className="text-crowe-coral">*</span>
            </label>
            <input
              id="model-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wire Fraud Detector v2"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="model-description" className="text-foreground text-sm font-medium">
              Description
            </label>
            <textarea
              id="model-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this model's purpose..."
              rows={3}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          {error && <p className="text-crowe-coral text-sm">{error}</p>}

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
              disabled={submitting || !name.trim()}
              className="bg-crowe-indigo-dark hover:bg-crowe-indigo text-white"
            >
              {submitting ? 'Creating...' : 'Create Model'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
