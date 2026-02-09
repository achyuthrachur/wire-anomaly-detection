'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import { Upload, Shield, BarChart3, Clock } from 'lucide-react';

const FEATURES = [
  {
    icon: Upload,
    title: 'Upload & Parse',
    description: 'Drag & drop CSV or XLSX files. Schema is inferred automatically from your data.',
  },
  {
    icon: Shield,
    title: 'Validate Structure',
    description: 'Check required columns, detect type mismatches, flag missing values and duplicates.',
  },
  {
    icon: BarChart3,
    title: 'Profile Distributions',
    description: 'Get statistical summaries, percentiles, cardinalities, and date ranges at a glance.',
  },
  {
    icon: Clock,
    title: 'Track Run History',
    description: 'Every upload creates a run. Review past validations, export results as JSON.',
  },
];

export default function HomePage() {
  return (
    <PageContainer>
      <FadeIn>
        <section className="flex flex-col items-center text-center pt-16 pb-20">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Wire Anomaly Detection
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Upload wire transaction datasets, validate structure and quality, and profile key fields — all in one streamlined workflow.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link href="/upload">
              <Button size="lg" className="gap-2 bg-crowe-indigo-dark hover:bg-crowe-indigo">
                <Upload className="h-4 w-4" />
                Start Upload
              </Button>
            </Link>
            <Link href="/runs">
              <Button variant="outline" size="lg">
                View Runs
              </Button>
            </Link>
          </div>
        </section>
      </FadeIn>

      <StaggerChildren className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 pb-20">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-crowe-amber/10">
              <feature.icon className="h-5 w-5 text-crowe-amber-dark" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </StaggerChildren>
    </PageContainer>
  );
}
