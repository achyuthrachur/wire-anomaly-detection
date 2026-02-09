'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { AnomalyMixSliders } from '@/components/synthetic/AnomalyMixSliders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FlaskConical,
  Users,
  BarChart3,
  CalendarDays,
  ShieldAlert,
  Sparkles,
  Loader2,
  Check,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  seed: number;
  nRowsTraining: number;
  nRowsScoring: number;
  initiators: number;
  reviewers: number;
  customers: number;
  beneficiaries: number;
  anomalyRateTraining: number;
  anomalyRateScoring: number;
  amountMu: number;
  amountSigma: number;
  anomalyMix: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultDates() {
  const today = new Date();
  const trainingStart = new Date(today);
  trainingStart.setDate(today.getDate() - 90);
  const scoringEnd = new Date(today);
  scoringEnd.setDate(today.getDate() + 30);

  return {
    trainingStart: trainingStart.toISOString().slice(0, 10),
    trainingEnd: today.toISOString().slice(0, 10),
    scoringStart: today.toISOString().slice(0, 10),
    scoringEnd: scoringEnd.toISOString().slice(0, 10),
  };
}

const INITIAL_STATE: FormState = {
  seed: 1337,
  nRowsTraining: 250_000,
  nRowsScoring: 75_000,
  initiators: 250,
  reviewers: 120,
  customers: 12_000,
  beneficiaries: 18_000,
  anomalyRateTraining: 0.007,
  anomalyRateScoring: 0.004,
  amountMu: 9.1,
  amountSigma: 1.0,
  anomalyMix: {
    highAmount: 0.3,
    burst: 0.2,
    outOfHoursIrregular: 0.2,
    riskCorridorCallbackBypass: 0.2,
    sodException: 0.1,
  },
};

// ---------------------------------------------------------------------------
// Section definitions for the progress rail
// ---------------------------------------------------------------------------

interface SectionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionDef[] = [
  { id: 'population', label: 'Population & Volume', icon: <Users className="h-4 w-4" /> },
  { id: 'distributions', label: 'Distributions', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'controls', label: 'Date Controls', icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'anomaly', label: 'Anomaly Mix', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'generate', label: 'Generate', icon: <Sparkles className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SyntheticWizardPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [activeSection, setActiveSection] = useState('population');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => defaultDates(), []);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleNumericInput = useCallback(
    (key: keyof FormState, raw: string) => {
      const parsed = Number(raw);
      if (!isNaN(parsed)) {
        updateField(key, parsed as FormState[typeof key]);
      }
    },
    [updateField]
  );

  // Build the SyntheticConfig payload
  const buildConfig = useCallback(() => {
    return {
      seed: form.seed,
      training: {
        nRows: form.nRowsTraining,
        dateStart: dates.trainingStart,
        dateEnd: dates.trainingEnd,
        anomalyRate: form.anomalyRateTraining,
      },
      scoring: {
        nRows: form.nRowsScoring,
        dateStart: dates.scoringStart,
        dateEnd: dates.scoringEnd,
        anomalyRate: form.anomalyRateScoring,
        hideLabelsByDefault: true,
      },
      population: {
        initiators: form.initiators,
        reviewers: form.reviewers,
        customers: form.customers,
        beneficiaries: form.beneficiaries,
      },
      distributions: {
        amount: { family: 'lognormal', mu: form.amountMu, sigma: form.amountSigma },
        wiresPerCustomer: { family: 'negbin', mean: 8, dispersion: 2 },
      },
      anomalyMix: form.anomalyMix,
    };
  }, [form, dates]);

  const handleGenerate = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/synthetic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: buildConfig() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      const { jobId } = await res.json();
      router.push(`/synthetic/jobs/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      setSubmitting(false);
    }
  }, [buildConfig, router]);

  // Track which sections have been "visited" (for the rail checkmarks)
  const sectionIndex = SECTIONS.findIndex((s) => s.id === activeSection);

  return (
    <PageContainer>
      <FadeIn>
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-3">
            <FlaskConical className="text-crowe-indigo h-7 w-7 shrink-0" />
            <h1 className="text-foreground text-2xl font-semibold">Synthetic Data Studio</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Configure and generate realistic wire transfer datasets for training and scoring. Adjust
            population sizes, anomaly distributions, and generation parameters below.
          </p>
        </div>
      </FadeIn>

      <div className="flex gap-8">
        {/* ----------------------------------------------------------------- */}
        {/* Left: Progress Rail                                                */}
        {/* ----------------------------------------------------------------- */}
        <FadeIn delay={50} className="hidden lg:block">
          <nav className="sticky top-28 w-52 space-y-1">
            {SECTIONS.map((section, idx) => {
              const isActive = section.id === activeSection;
              const isCompleted = idx < sectionIndex;

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
                    isActive
                      ? 'bg-crowe-indigo-dark/5 text-crowe-indigo-dark font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-colors',
                      isActive
                        ? 'bg-crowe-indigo-dark text-white'
                        : isCompleted
                          ? 'bg-crowe-teal text-white'
                          : 'bg-tint-100 text-tint-500'
                    )}
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className="truncate">{section.label}</span>
                  {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />}
                </button>
              );
            })}
          </nav>
        </FadeIn>

        {/* ----------------------------------------------------------------- */}
        {/* Right: Form Sections                                               */}
        {/* ----------------------------------------------------------------- */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* ─── Section 1: Population & Volume ─── */}
          <FadeIn delay={100}>
            <Card
              id="population"
              className={cn(
                'transition-shadow',
                activeSection === 'population' && 'ring-crowe-indigo-dark/20 ring-2'
              )}
              onClick={() => setActiveSection('population')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="text-crowe-indigo h-4.5 w-4.5" />
                  Population & Volume
                </CardTitle>
                <CardDescription>
                  Define the number of rows and entity pools for the generated datasets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    label="Seed"
                    value={form.seed}
                    onChange={(v) => handleNumericInput('seed', v)}
                    hint="Random seed for reproducibility"
                  />
                  <NumberField
                    label="Training Rows"
                    value={form.nRowsTraining}
                    onChange={(v) => handleNumericInput('nRowsTraining', v)}
                    hint="Number of wire records for training"
                  />
                  <NumberField
                    label="Scoring Rows"
                    value={form.nRowsScoring}
                    onChange={(v) => handleNumericInput('nRowsScoring', v)}
                    hint="Number of wire records for scoring"
                  />
                  <NumberField
                    label="Initiators"
                    value={form.initiators}
                    onChange={(v) => handleNumericInput('initiators', v)}
                    hint="Unique wire initiators"
                  />
                  <NumberField
                    label="Reviewers"
                    value={form.reviewers}
                    onChange={(v) => handleNumericInput('reviewers', v)}
                    hint="Unique reviewers/approvers"
                  />
                  <NumberField
                    label="Customers"
                    value={form.customers}
                    onChange={(v) => handleNumericInput('customers', v)}
                    hint="Unique customer accounts"
                  />
                  <NumberField
                    label="Beneficiaries"
                    value={form.beneficiaries}
                    onChange={(v) => handleNumericInput('beneficiaries', v)}
                    hint="Unique beneficiary accounts"
                  />
                  <NumberField
                    label="Training Anomaly Rate"
                    value={form.anomalyRateTraining}
                    onChange={(v) => handleNumericInput('anomalyRateTraining', v)}
                    hint="Fraction of anomalous rows (training)"
                    step="0.001"
                  />
                  <NumberField
                    label="Scoring Anomaly Rate"
                    value={form.anomalyRateScoring}
                    onChange={(v) => handleNumericInput('anomalyRateScoring', v)}
                    hint="Fraction of anomalous rows (scoring)"
                    step="0.001"
                  />
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* ─── Section 2: Distributions (readonly display) ─── */}
          <FadeIn delay={150}>
            <Card
              id="distributions"
              className={cn(
                'transition-shadow',
                activeSection === 'distributions' && 'ring-crowe-indigo-dark/20 ring-2'
              )}
              onClick={() => setActiveSection('distributions')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="text-crowe-indigo h-4.5 w-4.5" />
                  Distributions
                </CardTitle>
                <CardDescription>
                  Statistical distribution parameters for wire amounts. These are pre-calibrated
                  defaults.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField
                    label="Amount Family"
                    value="Log-Normal"
                    icon={<BarChart3 className="h-3.5 w-3.5" />}
                  />
                  <ReadonlyField label="Amount \u03BC (mu)" value={String(form.amountMu)} />
                  <ReadonlyField label="Amount \u03C3 (sigma)" value={String(form.amountSigma)} />
                  <ReadonlyField label="Wires/Customer Family" value="Negative Binomial" />
                  <ReadonlyField label="Wires/Customer Mean" value="8" />
                  <ReadonlyField label="Wires/Customer Dispersion" value="2" />
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* ─── Section 3: Date Controls (auto-calculated) ─── */}
          <FadeIn delay={200}>
            <Card
              id="controls"
              className={cn(
                'transition-shadow',
                activeSection === 'controls' && 'ring-crowe-indigo-dark/20 ring-2'
              )}
              onClick={() => setActiveSection('controls')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="text-crowe-indigo h-4.5 w-4.5" />
                  Date Controls
                </CardTitle>
                <CardDescription>
                  Auto-calculated date ranges. Training covers the past 90 days; scoring covers the
                  next 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-crowe-indigo-dark/5 text-crowe-indigo-dark border-crowe-indigo-dark/20 text-xs"
                      >
                        Training
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ReadonlyField label="Start Date" value={dates.trainingStart} />
                      <ReadonlyField label="End Date" value={dates.trainingEnd} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      90-day lookback window ({form.nRowsTraining.toLocaleString()} rows)
                    </p>
                  </div>
                  <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-crowe-amber/10 text-crowe-amber-dark border-crowe-amber/20 text-xs"
                      >
                        Scoring
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ReadonlyField label="Start Date" value={dates.scoringStart} />
                      <ReadonlyField label="End Date" value={dates.scoringEnd} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      30-day forward window ({form.nRowsScoring.toLocaleString()} rows)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* ─── Section 4: Anomaly Mix ─── */}
          <FadeIn delay={250}>
            <Card
              id="anomaly"
              className={cn(
                'transition-shadow',
                activeSection === 'anomaly' && 'ring-crowe-indigo-dark/20 ring-2'
              )}
              onClick={() => setActiveSection('anomaly')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="text-crowe-indigo h-4.5 w-4.5" />
                  Anomaly Mix
                </CardTitle>
                <CardDescription>
                  Adjust the proportion of each anomaly type. Sliders automatically rebalance to sum
                  to 100%.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnomalyMixSliders
                  value={form.anomalyMix}
                  onChange={(mix) => updateField('anomalyMix', mix)}
                />
              </CardContent>
            </Card>
          </FadeIn>

          {/* ─── Section 5: Generate ─── */}
          <FadeIn delay={300}>
            <Card
              id="generate"
              className={cn(
                'transition-shadow',
                activeSection === 'generate' && 'ring-crowe-indigo-dark/20 ring-2'
              )}
              onClick={() => setActiveSection('generate')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="text-crowe-amber h-4.5 w-4.5" />
                  Generate
                </CardTitle>
                <CardDescription>
                  Review your configuration and generate both training and scoring datasets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quick summary */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryChip
                    label="Training"
                    value={`${(form.nRowsTraining / 1000).toFixed(0)}K rows`}
                  />
                  <SummaryChip
                    label="Scoring"
                    value={`${(form.nRowsScoring / 1000).toFixed(0)}K rows`}
                  />
                  <SummaryChip
                    label="Entities"
                    value={`${((form.customers + form.beneficiaries) / 1000).toFixed(0)}K`}
                  />
                  <SummaryChip label="Seed" value={String(form.seed)} />
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-crowe-coral/10 border-crowe-coral/20 text-crowe-coral-dark rounded-lg border px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                {/* Generate button */}
                <Button
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="bg-crowe-indigo-dark hover:bg-crowe-indigo w-full text-white sm:w-auto"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Datasets
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  hint,
  step,
}: {
  label: string;
  value: number;
  onChange: (raw: string) => void;
  hint?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="text-foreground flex items-center gap-1.5 font-mono text-sm font-medium">
        {icon}
        {value}
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/60 rounded-lg border px-3 py-2 text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
