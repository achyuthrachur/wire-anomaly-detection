import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export type StepStatus = 'pending' | 'active' | 'complete' | 'error';

interface Step {
  label: string;
  status: StepStatus;
}

interface ProgressStepperProps {
  steps: Step[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                step.status === 'complete' && 'border-crowe-teal bg-crowe-teal text-white',
                step.status === 'active' && 'border-crowe-amber bg-crowe-amber/10 text-crowe-amber-dark',
                step.status === 'error' && 'border-crowe-coral bg-crowe-coral/10 text-crowe-coral',
                step.status === 'pending' && 'border-tint-300 bg-white text-tint-500',
              )}
            >
              {step.status === 'complete' ? (
                <Check className="h-5 w-5" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                step.status === 'complete' && 'text-crowe-teal',
                step.status === 'active' && 'text-crowe-amber-dark',
                step.status === 'error' && 'text-crowe-coral',
                step.status === 'pending' && 'text-tint-500',
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'mx-3 mb-6 h-0.5 w-16 transition-colors',
                step.status === 'complete' ? 'bg-crowe-teal' : 'bg-tint-100',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
