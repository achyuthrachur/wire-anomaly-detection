'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import { Upload, Shield, BarChart3, Clock, Box, Wand2, BookOpen } from 'lucide-react';

const FEATURES = [
  {
    icon: Upload,
    title: 'Upload & Parse',
    description: 'Drag & drop CSV or XLSX files. Schema is inferred automatically from your data.',
    href: '/upload',
  },
  {
    icon: Shield,
    title: 'Validate Structure',
    description:
      'Check required columns, detect type mismatches, flag missing values and duplicates.',
    href: '/datasets',
  },
  {
    icon: BarChart3,
    title: 'Profile Distributions',
    description:
      'Get statistical summaries, percentiles, cardinalities, and date ranges at a glance.',
    href: '/datasets',
  },
  {
    icon: Clock,
    title: 'Track Run History',
    description: 'Every upload creates a run. Review past validations, export results as JSON.',
    href: '/runs',
  },
  {
    icon: Box,
    title: 'Model Registry',
    description: 'Browse and manage trained models.',
    href: '/models',
  },
  {
    icon: Wand2,
    title: 'Synthetic Data Studio',
    description: 'Generate realistic wire transfer datasets.',
    href: '/synthetic',
  },
  {
    icon: BookOpen,
    title: 'How It Works',
    description: 'Technical documentation and methodology.',
    href: '/methodology',
  },
];

export default function HomePage() {
  return (
    <PageContainer>
      <FadeIn>
        <section className="flex flex-col items-center pt-16 pb-20 text-center">
          <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
            Wire Anomaly Detection
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg">
            Upload wire transaction datasets, validate structure and quality, and profile key fields
            — all in one streamlined workflow.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link href="/upload">
              <Button size="lg" className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2">
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

      <StaggerChildren className="grid gap-6 pb-20 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {FEATURES.map((feature) => (
          <Link
            key={feature.title}
            href={feature.href}
            className="border-border bg-card block rounded-xl border p-6 transition-shadow hover:shadow-md"
          >
            <div className="bg-crowe-amber/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <feature.icon className="text-crowe-amber-dark h-5 w-5" />
            </div>
            <h3 className="text-foreground mt-4 text-sm font-semibold">{feature.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {feature.description}
            </p>
          </Link>
        ))}
      </StaggerChildren>
    </PageContainer>
  );
}
