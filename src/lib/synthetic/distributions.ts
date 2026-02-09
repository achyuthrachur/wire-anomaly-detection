// ---------------------------------------------------------------------------
// Statistical distributions for synthetic data generation
// Uses seeded PRNG for reproducibility
// ---------------------------------------------------------------------------

import { seededRandom } from '@/lib/ml/algorithms/decision-tree';

/**
 * Box-Muller transform: generate a standard normal (mean=0, std=1) sample.
 */
export function normalSample(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

/**
 * Log-normal distribution sample.
 * If X ~ Normal(mu, sigma), then exp(X) ~ LogNormal(mu, sigma).
 */
export function lognormalSample(rng: () => number, mu: number, sigma: number): number {
  const normal = normalSample(rng);
  return Math.exp(mu + sigma * normal);
}

/**
 * Negative binomial approximation via Gamma-Poisson mixture.
 * mean and dispersion control the shape.
 */
export function negBinomialSample(rng: () => number, mean: number, dispersion: number): number {
  // Simple approximation: use Poisson with gamma-distributed rate
  // For simplicity, use geometric + offset approach
  const p = dispersion / (mean + dispersion);
  let count = 0;
  let successes = 0;
  const r = Math.max(1, Math.round(dispersion));
  while (successes < r) {
    if (rng() < p) {
      successes++;
    }
    count++;
  }
  return Math.max(0, count - r);
}

/**
 * Uniform date between start and end.
 */
export function uniformDateSample(rng: () => number, startDate: Date, endDate: Date): Date {
  const range = endDate.getTime() - startDate.getTime();
  return new Date(startDate.getTime() + rng() * range);
}

/**
 * Sample from a categorical distribution.
 */
export function categoricalSample<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Sample from a weighted categorical distribution.
 */
export function weightedCategoricalSample<T>(rng: () => number, items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export { seededRandom };
