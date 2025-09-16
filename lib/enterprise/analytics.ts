import {
  EnterpriseScenario,
  EnterpriseSolution,
  SimulationResult,
  TimelineLane,
  simulateEnterprise,
} from '@/lib/enterprise';

export type SweepKnob =
  | 'stripeWidth'
  | 'objectsInFlight'
  | 'chunkSizeKB'
  | 'queueDepth'
  | 'crcPer4kUs'
  | 'crcSigmaPer4kUs';

export interface SweepKnobDefinition {
  id: SweepKnob;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  helper?: string;
  format?: (value: number) => string;
}

export interface SweepConfig {
  knob: SweepKnob;
  start: number;
  end: number;
  step: number;
}

export interface SweepPoint {
  value: number;
  results: Record<EnterpriseSolution, SimulationResult>;
}

export interface SweepRun {
  baseScenario: EnterpriseScenario;
  config: SweepConfig;
  points: SweepPoint[];
  solutions: EnterpriseSolution[];
}

export type AdvisorTone = 'positive' | 'neutral' | 'warning';

export interface SweepAdvisorHint {
  id: string;
  tone: AdvisorTone;
  message: string;
}

export interface LatencyDistributionBin {
  index: number;
  start: number;
  end: number;
  count: number;
  density: number;
  cumulative: number;
}

export interface LatencyDistributionSummary {
  bins: LatencyDistributionBin[];
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  total: number;
  peakDensity: number;
}

export interface LaneBoxplotStats {
  laneId: string;
  label: string;
  sampleCount: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

const roundValue = (value: number): number => {
  return Number(value.toFixed(4));
};

export const SWEEP_KNOB_DEFINITIONS: Record<SweepKnob, SweepKnobDefinition> = {
  stripeWidth: {
    id: 'stripeWidth',
    label: 'Stripe Width',
    unit: '×',
    min: 1,
    max: 64,
    step: 1,
    helper: 'Number of SSDs participating in a stripe.',
  },
  objectsInFlight: {
    id: 'objectsInFlight',
    label: 'Objects in Flight',
    min: 1,
    max: 16,
    step: 1,
    helper: 'Concurrent files under CRC validation.',
  },
  chunkSizeKB: {
    id: 'chunkSizeKB',
    label: 'Chunk Size',
    unit: 'KiB',
    min: 4,
    max: 2048,
    step: 4,
    helper: 'Chunk size before MDTS enforcement.',
  },
  queueDepth: {
    id: 'queueDepth',
    label: 'Queue Depth / SSD',
    min: 1,
    max: 64,
    step: 1,
    helper: 'Outstanding CRC commands per SSD.',
  },
  crcPer4kUs: {
    id: 'crcPer4kUs',
    label: 'μ per 4 KiB',
    unit: 'µs',
    min: 5,
    max: 400,
    step: 5,
    helper: 'Average CRC service time baseline.',
  },
  crcSigmaPer4kUs: {
    id: 'crcSigmaPer4kUs',
    label: 'σ per 4 KiB',
    unit: 'µs',
    min: 0,
    max: 200,
    step: 5,
    helper: 'Jitter width applied to CRC service time.',
  },
};

const cloneScenario = (scenario: EnterpriseScenario): EnterpriseScenario => {
  return {
    ...scenario,
    hostCoefficients: { ...scenario.hostCoefficients },
    ssdCoefficients: { ...scenario.ssdCoefficients },
    calibration: scenario.calibration
      ? {
          ...scenario.calibration,
          hostCoefficients: scenario.calibration.hostCoefficients
            ? { ...scenario.calibration.hostCoefficients }
            : undefined,
          ssdCoefficients: scenario.calibration.ssdCoefficients
            ? { ...scenario.calibration.ssdCoefficients }
            : undefined,
          warnings: scenario.calibration.warnings ? [...scenario.calibration.warnings] : undefined,
        }
      : undefined,
  };
};

const buildSweepValues = (config: SweepConfig): number[] => {
  const definition = SWEEP_KNOB_DEFINITIONS[config.knob];
  const step = Math.max(Math.abs(config.step || definition.step || 1), 1e-9);
  const direction = config.end >= config.start ? 1 : -1;
  const values: number[] = [];
  const maxIterations = 1024;
  let current = config.start;

  for (let index = 0; index < maxIterations; index++) {
    const clamped = clamp(current, definition.min, definition.max);
    const rounded = roundValue(clamped);
    if (values.length === 0 || Math.abs(values[values.length - 1] - rounded) > 1e-6) {
      values.push(rounded);
    }

    if ((direction > 0 && current >= config.end) || (direction < 0 && current <= config.end)) {
      break;
    }

    current += direction * step;
  }

  const terminal = roundValue(clamp(config.end, definition.min, definition.max));
  if (values.length === 0 || Math.abs(values[values.length - 1] - terminal) > 1e-6) {
    values.push(terminal);
  }

  return values;
};

export const runSweep = (
  baseScenario: EnterpriseScenario,
  config: SweepConfig,
  solutions: EnterpriseSolution[] = ['s1', 's2', 's3'],
): SweepRun => {
  const values = buildSweepValues(config);
  const results: SweepPoint[] = [];

  values.forEach((value, sweepIndex) => {
    const scenarioForValue = cloneScenario(baseScenario);
    (scenarioForValue as Record<SweepKnob, number>)[config.knob] = value;

    const pointResults: Record<EnterpriseSolution, SimulationResult> = {} as Record<EnterpriseSolution, SimulationResult>;

    solutions.forEach((solution) => {
      const scenarioForSolution = cloneScenario(scenarioForValue);
      scenarioForSolution.solution = solution;
      // Nudge the seed to keep runs reproducible yet decorrelated per sweep point.
      scenarioForSolution.randomSeed = clamp(
        scenarioForValue.randomSeed + sweepIndex,
        1,
        2_147_483_647,
      );
      pointResults[solution] = simulateEnterprise(scenarioForSolution);
    });

    results.push({
      value,
      results: pointResults,
    });
  });

  return {
    baseScenario: cloneScenario(baseScenario),
    config,
    points: results,
    solutions,
  };
};

const percentile = (values: number[], fraction: number): number => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (fraction <= 0) {
    return sorted[0];
  }
  if (fraction >= 1) {
    return sorted[sorted.length - 1];
  }
  const index = fraction * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

export const computeLatencyDistribution = (
  latenciesUs: number[],
  desiredBins = 20,
): LatencyDistributionSummary => {
  if (!latenciesUs.length) {
    return {
      bins: [],
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      total: 0,
      peakDensity: 0,
    };
  }

  const values = [...latenciesUs];
  values.sort((a, b) => a - b);
  const total = values.length;
  const min = values[0];
  const max = values[values.length - 1];
  const span = Math.max(max - min, 1);
  const mean = values.reduce((sum, value) => sum + value, 0) / total;
  const variance = values.reduce((acc, value) => acc + (value - mean) * (value - mean), 0) / total;
  const stdDev = Math.sqrt(Math.max(variance, 0));
  const binCount = Math.max(1, Math.min(desiredBins, total));
  const binSize = span / binCount;
  const bins: LatencyDistributionBin[] = [];

  for (let index = 0; index < binCount; index++) {
    const start = index === 0 ? min : min + index * binSize;
    const end = index === binCount - 1 ? max : start + binSize;
    bins.push({
      index,
      start,
      end,
      count: 0,
      density: 0,
      cumulative: 0,
    });
  }

  values.forEach((value) => {
    if (binCount === 1) {
      bins[0].count += 1;
      return;
    }
    const ratio = clamp((value - min) / span, 0, 1);
    const index = Math.min(binCount - 1, Math.floor(ratio * binCount));
    bins[index].count += 1;
  });

  let cumulative = 0;
  let peakDensity = 0;
  bins.forEach((bin) => {
    cumulative += bin.count;
    bin.cumulative = cumulative / total;
    bin.density = bin.count / total;
    peakDensity = Math.max(peakDensity, bin.density);
  });

  return {
    bins,
    min,
    max,
    mean,
    stdDev,
    total,
    peakDensity,
  };
};

export const computeLaneBoxplots = (lanes: TimelineLane[]): LaneBoxplotStats[] => {
  const plots: LaneBoxplotStats[] = [];

  lanes.forEach((lane) => {
    if (lane.role !== 'ssd') {
      return;
    }
    const computeDurations = lane.segments
      .filter((segment) => segment.kind === 'compute')
      .map((segment) => segment.endUs - segment.startUs)
      .filter((duration) => duration > 0);

    if (!computeDurations.length) {
      return;
    }

    computeDurations.sort((a, b) => a - b);
    const stats: LaneBoxplotStats = {
      laneId: lane.id,
      label: lane.label,
      sampleCount: computeDurations.length,
      min: computeDurations[0],
      q1: percentile(computeDurations, 0.25),
      median: percentile(computeDurations, 0.5),
      q3: percentile(computeDurations, 0.75),
      max: computeDurations[computeDurations.length - 1],
    };
    plots.push(stats);
  });

  return plots;
};

const formatKnobValue = (definition: SweepKnobDefinition, value: number): string => {
  const formatter = definition.format ?? ((input: number) => {
    if (definition.unit === 'µs') {
      if (input >= 1000) {
        return `${(input / 1000).toFixed(2)} ms`;
      }
      return `${input.toFixed(0)} µs`;
    }
    if (definition.unit === 'KiB') {
      if (input >= 1024) {
        return `${(input / 1024).toFixed(1)} MiB`;
      }
      return `${input.toFixed(0)} KiB`;
    }
    return input.toFixed(0);
  });
  return formatter(value);
};

const findCriticalShare = (
  result: SimulationResult,
  labelFragment: string,
): number => {
  const match = result.kpis.criticalPath.find((entry) => entry.label.toLowerCase().includes(labelFragment));
  return match ? match.percent : 0;
};

const computeDominantSolution = (run: SweepRun): {
  dominant: EnterpriseSolution | null;
  counts: Record<EnterpriseSolution, number>;
  bestPerPoint: Array<{ value: number; solution: EnterpriseSolution; improvement: number }>;
} => {
  const counts: Record<EnterpriseSolution, number> = {
    s1: 0,
    s2: 0,
    s3: 0,
  };
  const bestPerPoint: Array<{ value: number; solution: EnterpriseSolution; improvement: number }> = [];

  run.points.forEach((point) => {
    const entries = run.solutions.map((solution) => {
      const result = point.results[solution];
      return {
        solution,
        p99: result.kpis.p99Us,
      };
    });
    entries.sort((a, b) => a.p99 - b.p99);
    const winner = entries[0];
    const runnerUp = entries[1] ?? winner;
    const improvement = runnerUp.p99 > 0
      ? ((runnerUp.p99 - winner.p99) / runnerUp.p99) * 100
      : 0;
    counts[winner.solution] += 1;
    bestPerPoint.push({ value: point.value, solution: winner.solution, improvement });
  });

  let dominant: EnterpriseSolution | null = null;
  let dominantCount = 0;
  run.solutions.forEach((solution) => {
    if (counts[solution] > dominantCount) {
      dominant = solution;
      dominantCount = counts[solution];
    }
  });

  return { dominant, counts, bestPerPoint };
};

export const generateSweepAdvisor = (run: SweepRun): SweepAdvisorHint[] => {
  const hints: SweepAdvisorHint[] = [];
  if (!run.points.length) {
    return hints;
  }

  const knobDefinition = SWEEP_KNOB_DEFINITIONS[run.config.knob];
  const { dominant, counts, bestPerPoint } = computeDominantSolution(run);
  const totalPoints = run.points.length;

  if (dominant) {
    const dominantPoints = bestPerPoint.filter((entry) => entry.solution === dominant);
    const avgImprovement = dominantPoints.reduce((sum, entry) => sum + entry.improvement, 0) / Math.max(dominantPoints.length, 1);
    const improvementLabel = avgImprovement > 0 ? `${avgImprovement.toFixed(1)}% p99 lead` : 'matching p99';
    hints.push({
      id: `dominant-${dominant}`,
      tone: 'positive',
      message: `${dominant.toUpperCase()} leads ${dominantPoints.length}/${totalPoints} sweep points with ${improvementLabel}.`,
    });
  }

  const firstWinner = bestPerPoint[0];
  const lastWinner = bestPerPoint[bestPerPoint.length - 1];
  if (firstWinner.solution !== lastWinner.solution) {
    const changeIndex = bestPerPoint.findIndex((entry) => entry.solution === lastWinner.solution);
    const changePoint = bestPerPoint[Math.max(changeIndex, 0)];
    hints.push({
      id: `crossover-${lastWinner.solution}`,
      tone: 'neutral',
      message: `${lastWinner.solution.toUpperCase()} overtakes ${firstWinner.solution.toUpperCase()} at ${formatKnobValue(knobDefinition, changePoint.value)} on this sweep.`,
    });
  }

  const hostHotspot = run.points.find((point) => {
    const hostResult = point.results.s2;
    return hostResult ? findCriticalShare(hostResult, 'host aggregation') >= 45 : false;
  });
  if (hostHotspot) {
    hints.push({
      id: 'host-hotspot',
      tone: 'warning',
      message: `Host aggregation consumes ≥45% of latency at ${formatKnobValue(knobDefinition, hostHotspot.value)} — consider SSD aggregation or reducing fan-in.`,
    });
  }

  const ssdHotspot = run.points.find((point) => {
    const ssdResult = point.results.s3;
    return ssdResult ? findCriticalShare(ssdResult, 'ssd aggregation') >= 45 : false;
  });
  if (ssdHotspot) {
    hints.push({
      id: 'ssd-hotspot',
      tone: 'warning',
      message: `SSD aggregation dominates beyond ${formatKnobValue(knobDefinition, ssdHotspot.value)} — round-robin policy or host combine may help.`,
    });
  }

  if (counts.s1 > 0 && counts.s2 > 0 && counts.s3 > 0 && hints.length < 4) {
    hints.push({
      id: 'balanced-tradeoff',
      tone: 'neutral',
      message: `All solutions win at least once; use this sweep to align architecture with deployment priorities.`,
    });
  }

  return hints.slice(0, 5);
};
