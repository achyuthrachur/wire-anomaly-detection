// ---------------------------------------------------------------------------
// Synthetic Wire Data Generator — deterministic, seeded, CSV output
// Pure TypeScript, uses Papa.unparse()
// ---------------------------------------------------------------------------

import Papa from 'papaparse';
import type { SyntheticConfig } from '@/lib/db/types';
import { generateEntityPools, type EntityPools } from './entities';
import {
  seededRandom,
  lognormalSample,
  uniformDateSample,
  categoricalSample,
} from './distributions';

export interface GeneratedDataset {
  csv: string;
  rowCount: number;
  columns: string[];
}

interface WireRow {
  WireID: string;
  WireDate: string;
  Amount: string;
  WireDirection: string;
  Initiator: string;
  Reviewer: string;
  CustomerID: string;
  BeneficiaryID: string;
  DestinationCountry: string;
  SourceCountry: string;
  CallbackVerified: string;
  ApprovalLevel: string;
  IsAnomaly: string;
}

const WIRE_COLUMNS: (keyof WireRow)[] = [
  'WireID',
  'WireDate',
  'Amount',
  'WireDirection',
  'Initiator',
  'Reviewer',
  'CustomerID',
  'BeneficiaryID',
  'DestinationCountry',
  'SourceCountry',
  'CallbackVerified',
  'ApprovalLevel',
  'IsAnomaly',
];

const WIRE_DIRECTIONS = ['Outbound', 'Inbound'];
const APPROVAL_LEVELS = ['Standard', 'Enhanced', 'Management'];

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateWireDataset(
  config: SyntheticConfig,
  role: 'training' | 'scoring',
  seed: number
): GeneratedDataset {
  const rng = seededRandom(seed);
  const pools = generateEntityPools(rng, config.population);

  const roleConfig = role === 'training' ? config.training : config.scoring;
  const nRows = roleConfig.nRows;
  const anomalyRate = roleConfig.anomalyRate;
  const dateStart = new Date(roleConfig.dateStart);
  const dateEnd = new Date(roleConfig.dateEnd);

  // Determine how many anomalies
  const nAnomalies = Math.round(nRows * anomalyRate);
  const nNormal = nRows - nAnomalies;

  // Generate anomaly indices (first nNormal are normal, rest are anomalies)
  // We'll shuffle at the end for a realistic distribution
  const rows: WireRow[] = [];

  // ---- Generate normal rows ----
  for (let i = 0; i < nNormal; i++) {
    rows.push(generateNormalRow(rng, pools, config, dateStart, dateEnd, i + 1));
  }

  // ---- Generate anomaly rows ----
  const anomalyMix = config.anomalyMix;
  const anomalyCounts = {
    highAmount: Math.round(nAnomalies * anomalyMix.highAmount),
    burst: Math.round(nAnomalies * anomalyMix.burst),
    outOfHoursIrregular: Math.round(nAnomalies * anomalyMix.outOfHoursIrregular),
    riskCorridorCallbackBypass: Math.round(nAnomalies * anomalyMix.riskCorridorCallbackBypass),
    sodException: 0,
  };
  // SOD gets the remainder to ensure exact total
  anomalyCounts.sodException =
    nAnomalies -
    anomalyCounts.highAmount -
    anomalyCounts.burst -
    anomalyCounts.outOfHoursIrregular -
    anomalyCounts.riskCorridorCallbackBypass;

  let wireIdCounter = nNormal + 1;

  // Pattern 1: High Amount
  for (let i = 0; i < anomalyCounts.highAmount; i++) {
    rows.push(generateHighAmountAnomaly(rng, pools, config, dateStart, dateEnd, wireIdCounter++));
  }

  // Pattern 2: Burst
  for (let i = 0; i < anomalyCounts.burst; i++) {
    rows.push(generateBurstAnomaly(rng, pools, config, dateStart, dateEnd, wireIdCounter++));
  }

  // Pattern 3: Out-of-Hours + Irregular Approval
  for (let i = 0; i < anomalyCounts.outOfHoursIrregular; i++) {
    rows.push(generateOutOfHoursAnomaly(rng, pools, config, dateStart, dateEnd, wireIdCounter++));
  }

  // Pattern 4: Risk Corridor + Callback Bypass
  for (let i = 0; i < anomalyCounts.riskCorridorCallbackBypass; i++) {
    rows.push(generateRiskCorridorAnomaly(rng, pools, config, dateStart, dateEnd, wireIdCounter++));
  }

  // Pattern 5: SOD Exception
  for (let i = 0; i < anomalyCounts.sodException; i++) {
    rows.push(generateSODAnomaly(rng, pools, config, dateStart, dateEnd, wireIdCounter++));
  }

  // Shuffle all rows for realistic distribution
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  // Re-assign wire IDs after shuffle for sequential ordering
  for (let i = 0; i < rows.length; i++) {
    rows[i].WireID = `W-${String(i + 1).padStart(7, '0')}`;
  }

  const csv = Papa.unparse(rows, { columns: WIRE_COLUMNS, newline: '\n' });

  return {
    csv,
    rowCount: rows.length,
    columns: WIRE_COLUMNS,
  };
}

// ---------------------------------------------------------------------------
// Row generators
// ---------------------------------------------------------------------------

function generateNormalRow(
  rng: () => number,
  pools: EntityPools,
  config: SyntheticConfig,
  dateStart: Date,
  dateEnd: Date,
  idx: number
): WireRow {
  const amount = lognormalSample(
    rng,
    config.distributions.amount.mu,
    config.distributions.amount.sigma
  );
  const wireDate = uniformDateSample(rng, dateStart, dateEnd);
  // Set time to business hours (8-17)
  wireDate.setHours(8 + Math.floor(rng() * 9), Math.floor(rng() * 60), Math.floor(rng() * 60));

  const initiator = categoricalSample(rng, pools.initiators);
  let reviewer = categoricalSample(rng, pools.reviewers);
  // Ensure initiator != reviewer for normal rows
  while (reviewer.includes(initiator.split('-')[1]) && pools.reviewers.length > 1) {
    reviewer = categoricalSample(rng, pools.reviewers);
  }

  const sourceCountry = categoricalSample(rng, pools.lowRiskCountries);
  const destCountry = categoricalSample(rng, pools.lowRiskCountries);

  // Approval level based on amount
  let approvalLevel: string;
  if (amount > 100000) {
    approvalLevel = 'Management';
  } else if (amount > 10000) {
    approvalLevel = 'Enhanced';
  } else {
    approvalLevel = 'Standard';
  }

  return {
    WireID: `W-${String(idx).padStart(7, '0')}`,
    WireDate: wireDate.toISOString(),
    Amount: amount.toFixed(2),
    WireDirection: categoricalSample(rng, WIRE_DIRECTIONS),
    Initiator: initiator,
    Reviewer: reviewer,
    CustomerID: categoricalSample(rng, pools.customers),
    BeneficiaryID: categoricalSample(rng, pools.beneficiaries),
    DestinationCountry: destCountry,
    SourceCountry: sourceCountry,
    CallbackVerified: 'true',
    ApprovalLevel: approvalLevel,
    IsAnomaly: '0',
  };
}

// Pattern 1: High Amount (5-20x baseline)
function generateHighAmountAnomaly(
  rng: () => number,
  pools: EntityPools,
  config: SyntheticConfig,
  dateStart: Date,
  dateEnd: Date,
  idx: number
): WireRow {
  const row = generateNormalRow(rng, pools, config, dateStart, dateEnd, idx);
  const baseAmount = parseFloat(row.Amount);
  const multiplier = 5 + rng() * 15; // 5-20x
  row.Amount = (baseAmount * multiplier).toFixed(2);
  row.IsAnomaly = '1';
  return row;
}

// Pattern 2: Burst (same customer, 3-7 wires within 15-60 min)
function generateBurstAnomaly(
  rng: () => number,
  pools: EntityPools,
  config: SyntheticConfig,
  dateStart: Date,
  dateEnd: Date,
  idx: number
): WireRow {
  const row = generateNormalRow(rng, pools, config, dateStart, dateEnd, idx);
  // Reduce time spread to simulate burst
  const burstDate = uniformDateSample(rng, dateStart, dateEnd);
  burstDate.setHours(Math.floor(rng() * 24), Math.floor(rng() * 60), Math.floor(rng() * 60));
  row.WireDate = burstDate.toISOString();
  row.IsAnomaly = '1';
  return row;
}

// Pattern 3: Out-of-hours + Irregular Approval
function generateOutOfHoursAnomaly(
  rng: () => number,
  pools: EntityPools,
  config: SyntheticConfig,
  dateStart: Date,
  dateEnd: Date,
  idx: number
): WireRow {
  const row = generateNormalRow(rng, pools, config, dateStart, dateEnd, idx);
  const oohDate = uniformDateSample(rng, dateStart, dateEnd);
  // Set to out-of-hours: 22:00-05:00
  const hour = rng() < 0.5 ? 22 + Math.floor(rng() * 2) : Math.floor(rng() * 5);
  oohDate.setHours(hour, Math.floor(rng() * 60), Math.floor(rng() * 60));
  row.WireDate = oohDate.toISOString();
  // Irregular: high amount but "Standard" approval
  const baseAmount = parseFloat(row.Amount);
  row.Amount = (baseAmount * (3 + rng() * 7)).toFixed(2);
  row.ApprovalLevel = 'Standard';
  row.IsAnomaly = '1';
  return row;
}

// Pattern 4: Risk Corridor + Callback Bypass
function generateRiskCorridorAnomaly(
  rng: () => number,
  pools: EntityPools,
  config: SyntheticConfig,
  dateStart: Date,
  dateEnd: Date,
  idx: number
): WireRow {
  const row = generateNormalRow(rng, pools, config, dateStart, dateEnd, idx);
  row.DestinationCountry = categoricalSample(rng, pools.highRiskCountries);
  row.CallbackVerified = 'false';
  row.IsAnomaly = '1';
  return row;
}

// Pattern 5: SOD Exception (initiator == reviewer)
function generateSODAnomaly(
  rng: () => number,
  pools: EntityPools,
  config: SyntheticConfig,
  dateStart: Date,
  dateEnd: Date,
  idx: number
): WireRow {
  const row = generateNormalRow(rng, pools, config, dateStart, dateEnd, idx);
  // Make reviewer a name derived from the initiator to simulate same person
  row.Reviewer = row.Initiator.replace('INI-', 'REV-');
  row.IsAnomaly = '1';
  return row;
}
