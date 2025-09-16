export type TimelineSegmentKind =
  | 'io'
  | 'compute'
  | 'aggregation'
  | 'finalize'
  | 'retry'
  | 'wait';

export type EnterpriseSolution = 's1' | 's2' | 's3';
export type AggregatorPolicy = 'pinned' | 'roundRobin';
export type ServiceDistribution = 'deterministic' | 'lognormal' | 'gamma';
export type RetryPolicy = 'fixed' | 'exponential';

export interface HostCoefficients {
  c0: number;
  c1: number;
  c2: number;
}

export interface SsdCoefficients {
  d0: number;
  d1: number;
}

export interface CalibrationProfile {
  id: string;
  label: string;
  device?: string;
  firmware?: string;
  createdAt: string;
  source: 'log' | 'manual' | 'imported';
  muPer4kUs: number;
  sigmaPer4kUs: number;
  nvmeLatencyUs: number;
  queueDepth?: number;
  threads?: number;
  readNlb?: number;
  mdtsBytes?: number;
  tolerancePercent?: number;
  sampleCount: number;
  hostCoefficients?: Partial<HostCoefficients>;
  ssdCoefficients?: Partial<SsdCoefficients>;
  notes?: string;
  warnings?: string[];
}

export interface ScenarioCalibration {
  profileId: string | null;
  label?: string;
  device?: string;
  firmware?: string;
  source?: string;
  sampleCount?: number;
  muPer4kUs?: number;
  sigmaPer4kUs?: number;
  nvmeLatencyUs?: number;
  queueDepth?: number;
  threads?: number;
  readNlb?: number;
  mdtsBytes?: number;
  tolerancePercent?: number;
  appliedAt?: string;
  useProfileDefaults: boolean;
  hostCoefficients?: Partial<HostCoefficients>;
  ssdCoefficients?: Partial<SsdCoefficients>;
  warnings?: string[];
}

export interface EnterpriseScenario {
  stripeWidth: number;
  objectsInFlight: number;
  fileSizeMB: number;
  chunkSizeKB: number;
  queueDepth: number;
  threads: number;
  hostCoefficients: HostCoefficients;
  ssdCoefficients: SsdCoefficients;
  nvmeLatencyUs: number;
  crcPer4kUs: number;
  crcSigmaPer4kUs: number;
  serviceDistribution: ServiceDistribution;
  stragglerP95Multiplier: number;
  stragglerP99Multiplier: number;
  failureProbability: number;
  retryPolicy: RetryPolicy;
  retryBackoffUs: number;
  retryMaxAttempts: number;
  orchestrationOverheadUs: number;
  mdtsBytes: number;
  solution: EnterpriseSolution;
  aggregatorPolicy: AggregatorPolicy;
  randomSeed: number;
  calibration?: ScenarioCalibration;
}

export interface TimelineSegment {
  startUs: number;
  endUs: number;
  label: string;
  kind: TimelineSegmentKind;
  chunkIndex?: number;
  commandIndex?: number;
}

export interface TimelineLane {
  id: string;
  label: string;
  role: 'ssd' | 'host' | 'aggregator';
  segments: TimelineSegment[];
  totalUs: number;
  isCritical: boolean;
}

export interface KPIBreakdown {
  label: string;
  valueUs: number;
  percent: number;
}

export interface SimulationKPIs {
  latencyUs: number;
  throughputObjsPerSec: number;
  p50Us: number;
  p95Us: number;
  p99Us: number;
  criticalPath: KPIBreakdown[];
  confidence?: KPIConfidenceSet;
}

export interface EventLogEntry {
  timeUs: number;
  message: string;
  type: 'info' | 'warning';
  relatedObject?: number;
  laneId?: string;
  chunkIndex?: number;
  attempt?: number;
  deltaUs?: number;
}

export interface RunbookEntry {
  id: string;
  timeUs: number;
  objectIndex: number;
  laneId: string;
  chunkIndex: number;
  attempt: number;
  retryDelayUs: number;
  additionalLatencyUs: number;
  message: string;
}

export interface QueueHeatmapSample {
  timeUs: number;
  occupancy: number;
}

export interface QueueHeatmapLane {
  id: string;
  label: string;
  role: 'ssd' | 'aggregator' | 'host';
  samples: QueueHeatmapSample[];
  peak: number;
}

export type AggregationLocation = 'serial' | 'host' | 'ssd';

export interface KPIConfidenceInterval {
  margin: number;
  lower: number;
  upper: number;
}

export interface KPIConfidenceSet {
  confidenceLevel: number;
  sampleCount: number;
  objectCount: number;
  source: 'calibration' | 'simulation';
  p50?: KPIConfidenceInterval;
  p95?: KPIConfidenceInterval;
  p99?: KPIConfidenceInterval;
  latency?: KPIConfidenceInterval;
  throughput?: KPIConfidenceInterval;
}

export interface AggregationTreeStage {
  id: string;
  level: number;
  label: string;
  fanIn: number;
  durationUs: number;
  nodes: number;
}

export interface AggregationTree {
  location: AggregationLocation;
  totalUs: number;
  depth: number;
  stages: AggregationTreeStage[];
  policy?: AggregatorPolicy;
}

export interface SimulationDerived {
  fileBytes: number;
  chunkBytes: number;
  totalChunks: number;
  stripes: number;
  mdtsSegmentsPerChunk: number;
  mdtsClamp: boolean;
  ssdComputeCriticalPathUs: number;
  ssdAggregateCriticalPathUs: number;
  aggregatorTotalUs: number;
  aggregatorPerStripeUs: number;
  totalLatencyUs: number;
  objectLatenciesUs: number[];
  failures: number;
  retries: number;
  randomSeed: number;
  pipelineFillUs?: number;
  steadyStateUs?: number;
  aggregatorLocation: AggregationLocation;
  commandsPerObject: number;
  calibration?: SimulationCalibrationSummary;
}

export interface SimulationResult {
  scenario: EnterpriseScenario;
  derived: SimulationDerived;
  lanes: TimelineLane[];
  events: EventLogEntry[];
  kpis: SimulationKPIs;
  aggregationTree: AggregationTree;
  heatmap: QueueHeatmapLane[];
  runbook: RunbookEntry[];
}

export interface SimulationCalibrationSummary {
  profileId: string | null;
  label?: string;
  device?: string;
  firmware?: string;
  source?: string;
  sampleCount?: number;
  tolerancePercent?: number;
  warnings: string[];
  applied: boolean;
  useProfileDefaults: boolean;
  muPer4kUs?: number;
  sigmaPer4kUs?: number;
}

export const ENTERPRISE_PHASE3_PRESET: EnterpriseScenario = {
  stripeWidth: 8,
  objectsInFlight: 3,
  fileSizeMB: 32,
  chunkSizeKB: 64,
  queueDepth: 8,
  threads: 8,
  hostCoefficients: {
    c0: 22,
    c1: 1.4,
    c2: 7,
  },
  ssdCoefficients: {
    d0: 64,
    d1: 2.2,
  },
  nvmeLatencyUs: 12,
  crcPer4kUs: 95,
  crcSigmaPer4kUs: 18,
  serviceDistribution: 'lognormal',
  stragglerP95Multiplier: 1.7,
  stragglerP99Multiplier: 2.8,
  failureProbability: 0.002,
  retryPolicy: 'fixed',
  retryBackoffUs: 80,
  retryMaxAttempts: 3,
  orchestrationOverheadUs: 18,
  mdtsBytes: 128 * 1024,
  solution: 's2',
  aggregatorPolicy: 'pinned',
  randomSeed: 1337,
  calibration: {
    profileId: null,
    label: undefined,
    useProfileDefaults: false,
    tolerancePercent: 15,
    warnings: [],
  },
};

export const cloneEnterpriseScenario = (scenario: EnterpriseScenario): EnterpriseScenario => {
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
          warnings: scenario.calibration.warnings
            ? [...scenario.calibration.warnings]
            : undefined,
        }
      : undefined,
  };
};

const applyPresetOverrides = (overrides: Partial<EnterpriseScenario>): EnterpriseScenario => {
  const base = cloneEnterpriseScenario(ENTERPRISE_PHASE3_PRESET);
  const calibrationOverride = Object.prototype.hasOwnProperty.call(overrides, 'calibration')
    ? overrides.calibration
    : base.calibration;
  return {
    ...base,
    ...overrides,
    hostCoefficients: {
      ...base.hostCoefficients,
      ...(overrides.hostCoefficients ?? {}),
    },
    ssdCoefficients: {
      ...base.ssdCoefficients,
      ...(overrides.ssdCoefficients ?? {}),
    },
    calibration: calibrationOverride
      ? {
          ...calibrationOverride,
          hostCoefficients: calibrationOverride.hostCoefficients
            ? { ...calibrationOverride.hostCoefficients }
            : undefined,
          ssdCoefficients: calibrationOverride.ssdCoefficients
            ? { ...calibrationOverride.ssdCoefficients }
            : undefined,
          warnings: calibrationOverride.warnings ? [...calibrationOverride.warnings] : undefined,
        }
      : undefined,
  };
};

export interface EnterprisePresetDefinition {
  id: string;
  label: string;
  summary: string;
  description?: string;
  scenario: EnterpriseScenario;
}

export const ENTERPRISE_PRESETS: EnterprisePresetDefinition[] = [
  {
    id: 'baseline',
    label: 'Baseline 8× Gen4x4',
    summary: 'Lognormal service with host aggregation tuned for 8 SSDs.',
    description: 'Reference scenario used across docs and walkthroughs.',
    scenario: applyPresetOverrides({
      randomSeed: 1337,
      serviceDistribution: 'lognormal',
      calibration: {
        profileId: null,
        label: undefined,
        useProfileDefaults: false,
        tolerancePercent: 15,
        warnings: [],
      },
    }),
  },
  {
    id: 'host16',
    label: '16× Host Aggregation',
    summary: 'Emphasises host combine cost on a 16-way stripe.',
    description: 'Use to explore host CPU headroom when widening the fan-out.',
    scenario: applyPresetOverrides({
      stripeWidth: 16,
      objectsInFlight: 4,
      fileSizeMB: 48,
      chunkSizeKB: 128,
      queueDepth: 12,
      hostCoefficients: {
        c0: 34,
        c1: 2.2,
        c2: 10.2,
      },
      ssdCoefficients: {
        d0: 70,
        d1: 2.4,
      },
      solution: 's2',
      orchestrationOverheadUs: 22,
      stragglerP95Multiplier: 1.5,
      stragglerP99Multiplier: 2.4,
      randomSeed: 2023,
    }),
  },
  {
    id: 'ssd16',
    label: '16× SSD Aggregation',
    summary: 'Models device-side aggregation on a wide stripe.',
    description: 'Highlights aggregator SSD behaviour with round-robin policy.',
    scenario: applyPresetOverrides({
      stripeWidth: 16,
      objectsInFlight: 6,
      fileSizeMB: 64,
      chunkSizeKB: 128,
      queueDepth: 16,
      solution: 's3',
      aggregatorPolicy: 'roundRobin',
      ssdCoefficients: {
        d0: 38,
        d1: 1.8,
      },
      hostCoefficients: {
        c0: 18,
        c1: 1.1,
        c2: 6.4,
      },
      stragglerP95Multiplier: 1.4,
      stragglerP99Multiplier: 2.0,
      serviceDistribution: 'lognormal',
      randomSeed: 9042,
    }),
  },
  {
    id: 'stress32',
    label: 'Stress 32× p99',
    summary: 'Heavy concurrency with straggler amplification.',
    description: 'Use to test guardrails and tail-latency sensitivity.',
    scenario: applyPresetOverrides({
      stripeWidth: 32,
      objectsInFlight: 8,
      fileSizeMB: 96,
      chunkSizeKB: 192,
      mdtsBytes: 256 * 1024,
      queueDepth: 20,
      serviceDistribution: 'gamma',
      crcPer4kUs: 110,
      crcSigmaPer4kUs: 32,
      stragglerP95Multiplier: 2.2,
      stragglerP99Multiplier: 4.1,
      failureProbability: 0.006,
      retryPolicy: 'exponential',
      retryBackoffUs: 120,
      retryMaxAttempts: 5,
      solution: 's3',
      aggregatorPolicy: 'pinned',
      orchestrationOverheadUs: 28,
      randomSeed: 7321,
      calibration: {
        profileId: null,
        label: undefined,
        useProfileDefaults: false,
        tolerancePercent: 15,
        warnings: [],
      },
    }),
  },
];

interface ChunkInfo {
  chunkIndex: number;
  stripeIndex: number;
  laneIndex: number;
  totalBytes: number;
  segments: number[];
}

interface CommandJob {
  objectIndex: number;
  chunkIndex: number;
  stripeIndex: number;
  laneIndex: number;
  segmentIndex: number;
  bytes: number;
}

interface CommandCompletion {
  objectIndex: number;
  chunkIndex: number;
  stripeIndex: number;
  laneIndex: number;
  completionTimeUs: number;
}

interface OccupancyEvent {
  timeUs: number;
  delta: number;
}

interface LaneSimulationResult {
  lane: TimelineLane;
  completions: CommandCompletion[];
  events: EventLogEntry[];
  runbook: RunbookEntry[];
  occupancyEvents: OccupancyEvent[];
  failures: number;
  retries: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const toBytes = (mb: number): number => {
  return Math.max(1, Math.round(mb * 1024 * 1024));
};

const toChunkBytes = (kb: number): number => {
  return Math.max(4096, Math.round(kb * 1024));
};

const log2Safe = (value: number): number => {
  return Math.log2(Math.max(1, value));
};

const toPercent = (value: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * 100;
};

const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sampleNormal = (rng: () => number): number => {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const sampleLogNormal = (mean: number, std: number, rng: () => number): number => {
  if (std <= 0) {
    return mean;
  }
  const variance = std * std;
  const muSquare = Math.log(1 + variance / (mean * mean));
  const sigma = Math.sqrt(muSquare);
  const mu = Math.log(mean) - sigma * sigma / 2;
  const normal = sampleNormal(rng);
  return Math.exp(mu + sigma * normal);
};

const sampleGamma = (mean: number, std: number, rng: () => number): number => {
  if (std <= 0) {
    return mean;
  }
  const variance = std * std;
  const shape = Math.max(0.001, (mean * mean) / variance);
  const scale = variance / mean;

  if (shape < 1) {
    while (true) {
      const u = rng();
      const v = rng();
      const x = Math.pow(u, 1 / shape);
      const y = Math.pow(v, 1 / (1 - shape));
      if (x + y <= 1) {
        const e = -Math.log(rng());
        return scale * e * x / (x + y);
      }
    }
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    const x = sampleNormal(rng);
    let v = 1 + c * x;
    if (v <= 0) {
      continue;
    }
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.331 * Math.pow(x, 4)) {
      return scale * d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return scale * d * v;
    }
  }
};

const sampleServiceTime = (scenario: EnterpriseScenario, bytes: number, rng: () => number): number => {
  const units = Math.max(1, bytes / 4096);
  const mean = scenario.crcPer4kUs * units;
  const sigma = Math.max(0, scenario.crcSigmaPer4kUs) * units;

  let sample: number;
  switch (scenario.serviceDistribution) {
    case 'lognormal':
      sample = sampleLogNormal(mean, sigma, rng);
      break;
    case 'gamma':
      sample = sampleGamma(mean, sigma, rng);
      break;
    default:
      sample = mean;
      break;
  }

  const tailRoll = rng();
  if (tailRoll > 0.99) {
    sample *= scenario.stragglerP99Multiplier;
  } else if (tailRoll > 0.95) {
    sample *= scenario.stragglerP95Multiplier;
  }

  return Math.max(sample, 1);
};

const normaliseHostCalibration = (
  input?: Partial<HostCoefficients>,
): Partial<HostCoefficients> | undefined => {
  if (!input) {
    return undefined;
  }
  const next: Partial<HostCoefficients> = {};
  if (typeof input.c0 === 'number') {
    next.c0 = input.c0;
  }
  if (typeof input.c1 === 'number') {
    next.c1 = input.c1;
  }
  if (typeof input.c2 === 'number') {
    next.c2 = input.c2;
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

const normaliseSsdCalibration = (
  input?: Partial<SsdCoefficients>,
): Partial<SsdCoefficients> | undefined => {
  if (!input) {
    return undefined;
  }
  const next: Partial<SsdCoefficients> = {};
  if (typeof input.d0 === 'number') {
    next.d0 = input.d0;
  }
  if (typeof input.d1 === 'number') {
    next.d1 = input.d1;
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

const normaliseCalibration = (calibration?: ScenarioCalibration): ScenarioCalibration | undefined => {
  if (!calibration) {
    return undefined;
  }
  const warnings = Array.isArray(calibration.warnings)
    ? calibration.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
    : [];
  const tolerance = calibration.tolerancePercent !== undefined
    ? clamp(calibration.tolerancePercent, 1, 100)
    : undefined;

  return {
    profileId: calibration.profileId ?? null,
    label: typeof calibration.label === 'string' ? calibration.label : undefined,
    device: typeof calibration.device === 'string' ? calibration.device : undefined,
    firmware: typeof calibration.firmware === 'string' ? calibration.firmware : undefined,
    source: typeof calibration.source === 'string' ? calibration.source : undefined,
    sampleCount: calibration.sampleCount !== undefined ? Math.max(0, Math.round(calibration.sampleCount)) : undefined,
    muPer4kUs: calibration.muPer4kUs,
    sigmaPer4kUs: calibration.sigmaPer4kUs,
    nvmeLatencyUs: calibration.nvmeLatencyUs,
    queueDepth: calibration.queueDepth !== undefined ? clamp(Math.round(calibration.queueDepth), 1, 128) : undefined,
    threads: calibration.threads !== undefined ? clamp(Math.round(calibration.threads), 1, 256) : undefined,
    readNlb: calibration.readNlb !== undefined ? clamp(Math.round(calibration.readNlb), 1, 128) : undefined,
    mdtsBytes: calibration.mdtsBytes !== undefined ? clamp(Math.round(calibration.mdtsBytes), 4096, 16 * 1024 * 1024) : undefined,
    tolerancePercent: tolerance,
    appliedAt: calibration.appliedAt,
    useProfileDefaults: Boolean(calibration.useProfileDefaults),
    hostCoefficients: normaliseHostCalibration(calibration.hostCoefficients),
    ssdCoefficients: normaliseSsdCalibration(calibration.ssdCoefficients),
    warnings,
  };
};

const normaliseScenario = (scenario: EnterpriseScenario): EnterpriseScenario => {
  const calibration = normaliseCalibration(scenario.calibration);
  const solution: EnterpriseSolution = ['s1', 's2', 's3'].includes(scenario.solution)
    ? scenario.solution
    : 's2';
  const aggregatorPolicy: AggregatorPolicy = scenario.aggregatorPolicy === 'roundRobin' ? 'roundRobin' : 'pinned';

  const normalised: EnterpriseScenario = {
    stripeWidth: clamp(Math.round(scenario.stripeWidth), 1, 64),
    objectsInFlight: clamp(Math.round(scenario.objectsInFlight), 1, 16),
    fileSizeMB: clamp(scenario.fileSizeMB, 0.5, 4096),
    chunkSizeKB: clamp(scenario.chunkSizeKB, 4, 2048),
    queueDepth: clamp(Math.round(scenario.queueDepth), 1, 64),
    threads: clamp(Math.round(scenario.threads), 1, 256),
    hostCoefficients: {
      c0: clamp(scenario.hostCoefficients.c0, 0, 500),
      c1: clamp(scenario.hostCoefficients.c1, 0, 50),
      c2: clamp(scenario.hostCoefficients.c2, 0, 200),
    },
    ssdCoefficients: {
      d0: clamp(scenario.ssdCoefficients.d0, 0, 400),
      d1: clamp(scenario.ssdCoefficients.d1, 0, 40),
    },
    nvmeLatencyUs: clamp(scenario.nvmeLatencyUs, 1, 200),
    crcPer4kUs: clamp(scenario.crcPer4kUs, 1, 500),
    crcSigmaPer4kUs: clamp(scenario.crcSigmaPer4kUs, 0, 500),
    serviceDistribution: ['deterministic', 'lognormal', 'gamma'].includes(scenario.serviceDistribution)
      ? scenario.serviceDistribution
      : 'deterministic',
    stragglerP95Multiplier: clamp(scenario.stragglerP95Multiplier, 1, 10),
    stragglerP99Multiplier: clamp(scenario.stragglerP99Multiplier, 1, 20),
    failureProbability: clamp(scenario.failureProbability, 0, 0.5),
    retryPolicy: scenario.retryPolicy === 'exponential' ? 'exponential' : 'fixed',
    retryBackoffUs: clamp(scenario.retryBackoffUs, 0, 1_000_000),
    retryMaxAttempts: clamp(Math.round(scenario.retryMaxAttempts), 1, 10),
    orchestrationOverheadUs: clamp(scenario.orchestrationOverheadUs, 0, 500),
    mdtsBytes: clamp(Math.round(scenario.mdtsBytes), 4096, 16 * 1024 * 1024),
    solution,
    aggregatorPolicy,
    randomSeed: clamp(Math.round(scenario.randomSeed), 1, 2_147_483_647),
    calibration,
  };

  if (calibration?.useProfileDefaults) {
    if (typeof calibration.muPer4kUs === 'number') {
      normalised.crcPer4kUs = clamp(calibration.muPer4kUs, 1, 500);
    }
    if (typeof calibration.sigmaPer4kUs === 'number') {
      normalised.crcSigmaPer4kUs = clamp(calibration.sigmaPer4kUs, 0, 500);
    }
    if (typeof calibration.nvmeLatencyUs === 'number') {
      normalised.nvmeLatencyUs = clamp(calibration.nvmeLatencyUs, 1, 500);
    }
    if (typeof calibration.queueDepth === 'number') {
      normalised.queueDepth = clamp(Math.round(calibration.queueDepth), 1, 64);
    }
    if (typeof calibration.threads === 'number') {
      normalised.threads = clamp(Math.round(calibration.threads), 1, 256);
    }
    if (typeof calibration.mdtsBytes === 'number') {
      normalised.mdtsBytes = clamp(Math.round(calibration.mdtsBytes), 4096, 16 * 1024 * 1024);
    }
    if (calibration.hostCoefficients) {
      normalised.hostCoefficients = {
        c0: calibration.hostCoefficients.c0 ?? normalised.hostCoefficients.c0,
        c1: calibration.hostCoefficients.c1 ?? normalised.hostCoefficients.c1,
        c2: calibration.hostCoefficients.c2 ?? normalised.hostCoefficients.c2,
      };
    }
    if (calibration.ssdCoefficients) {
      normalised.ssdCoefficients = {
        d0: calibration.ssdCoefficients.d0 ?? normalised.ssdCoefficients.d0,
        d1: calibration.ssdCoefficients.d1 ?? normalised.ssdCoefficients.d1,
      };
    }
  }

  return normalised;
};

const buildChunkInfos = (
  scenario: EnterpriseScenario,
  fileBytes: number,
  chunkBytes: number,
): ChunkInfo[] => {
  const totalChunks = Math.max(1, Math.ceil(fileBytes / chunkBytes));
  const mdts = Math.max(4096, scenario.mdtsBytes);
  const chunkInfos: ChunkInfo[] = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const stripeIndex = Math.floor(chunkIndex / scenario.stripeWidth);
    const laneIndex = chunkIndex % scenario.stripeWidth;
    const startByte = chunkIndex * chunkBytes;
    const remaining = Math.min(chunkBytes, Math.max(fileBytes - startByte, 0));
    const segments: number[] = [];
    let bytesRemaining = remaining;
    while (bytesRemaining > 0) {
      const take = Math.min(mdts, bytesRemaining);
      segments.push(take);
      bytesRemaining -= take;
    }
    if (segments.length === 0) {
      segments.push(Math.min(mdts, chunkBytes));
    }
    chunkInfos.push({
      chunkIndex,
      stripeIndex,
      laneIndex,
      totalBytes: remaining,
      segments,
    });
  }

  return chunkInfos;
};

const buildLaneJobs = (
  scenario: EnterpriseScenario,
  chunkInfos: ChunkInfo[],
  stripes: number,
): CommandJob[][] => {
  const laneJobs: CommandJob[][] = Array.from({ length: scenario.stripeWidth }, () => []);
  for (let stripeIndex = 0; stripeIndex < stripes; stripeIndex++) {
    for (let objectIndex = 0; objectIndex < scenario.objectsInFlight; objectIndex++) {
      for (let laneIndex = 0; laneIndex < scenario.stripeWidth; laneIndex++) {
        const chunkIndex = stripeIndex * scenario.stripeWidth + laneIndex;
        if (chunkIndex >= chunkInfos.length) {
          continue;
        }
        const chunk = chunkInfos[chunkIndex];
        chunk.segments.forEach((bytes, segmentIndex) => {
          laneJobs[laneIndex].push({
            objectIndex,
            chunkIndex,
            stripeIndex,
            laneIndex,
            segmentIndex,
            bytes,
          });
        });
      }
    }
  }
  return laneJobs;
};

const createTimelineSegment = (
  startUs: number,
  endUs: number,
  label: string,
  kind: TimelineSegmentKind,
  chunkIndex?: number,
  commandIndex?: number,
): TimelineSegment | null => {
  if (!Number.isFinite(startUs) || !Number.isFinite(endUs) || endUs <= startUs) {
    return null;
  }
  return {
    startUs,
    endUs,
    label,
    kind,
    chunkIndex,
    commandIndex,
  };
};

const simulateLane = (
  scenario: EnterpriseScenario,
  laneIndex: number,
  jobs: CommandJob[],
  rng: () => number,
): LaneSimulationResult => {
  const laneId = `ssd-${laneIndex}`;
  const segments: TimelineSegment[] = [];
  const completions: CommandCompletion[] = [];
  const events: EventLogEntry[] = [];
  const runbook: RunbookEntry[] = [];
  const occupancyEvents: OccupancyEvent[] = [];
  const serverAvailability: number[] = Array.from({ length: scenario.queueDepth }, () => 0);

  let issueCursor = 0;
  let laneTotal = 0;
  let failures = 0;
  let retries = 0;

  for (const job of jobs) {
    let attempt = 0;
    let success = false;
    let lastCompletionEnd = 0;
    let retriesForJob = 0;
    while (!success) {
      attempt += 1;
      const issueStart = Math.max(issueCursor, lastCompletionEnd);
      const issueEnd = issueStart + scenario.nvmeLatencyUs;
      const issueSegment = createTimelineSegment(
        issueStart,
        issueEnd,
        `Issue ${Math.round(job.bytes / 1024)} KiB (try ${attempt})`,
        'io',
        job.chunkIndex,
        job.segmentIndex,
      );
      if (issueSegment) {
        segments.push(issueSegment);
      }
      occupancyEvents.push({ timeUs: issueStart, delta: 1 });

      let serverIndex = 0;
      let earliest = serverAvailability[0];
      for (let idx = 1; idx < serverAvailability.length; idx++) {
        if (serverAvailability[idx] < earliest) {
          earliest = serverAvailability[idx];
          serverIndex = idx;
        }
      }

      const computeStart = Math.max(issueEnd, earliest);
      if (computeStart > issueEnd) {
        const waitSegment = createTimelineSegment(
          issueEnd,
          computeStart,
          'Queue wait',
          'wait',
          job.chunkIndex,
          job.segmentIndex,
        );
        if (waitSegment) {
          segments.push(waitSegment);
        }
      }

      const computeDuration = sampleServiceTime(scenario, job.bytes, rng);
      const computeEnd = computeStart + computeDuration;
      serverAvailability[serverIndex] = computeEnd;

      const computeSegment = createTimelineSegment(
        computeStart,
        computeEnd,
        `CRC ${Math.round(job.bytes / 1024)} KiB (try ${attempt})`,
        'compute',
        job.chunkIndex,
        job.segmentIndex,
      );
      if (computeSegment) {
        segments.push(computeSegment);
      }

      const completionStart = computeEnd;
      const completionEnd = completionStart + scenario.nvmeLatencyUs;
      const completionSegment = createTimelineSegment(
        completionStart,
        completionEnd,
        `Completion (try ${attempt})`,
        'io',
        job.chunkIndex,
        job.segmentIndex,
      );
      if (completionSegment) {
        segments.push(completionSegment);
      }
      occupancyEvents.push({ timeUs: completionEnd, delta: -1 });

      laneTotal = Math.max(laneTotal, completionEnd);
      issueCursor = Math.max(issueCursor, issueEnd);

      const isFinalAttempt = attempt >= scenario.retryMaxAttempts;
      const failureRoll = rng();
      const failed = !isFinalAttempt && failureRoll < scenario.failureProbability;
      const queueWait = Math.max(0, computeStart - issueEnd);
      const attemptDuration = (issueEnd - issueStart) + queueWait + computeDuration + scenario.nvmeLatencyUs;

      if (failed) {
        failures += 1;
        retries += 1;
        retriesForJob += 1;
        const retryDelay = scenario.retryPolicy === 'exponential'
          ? scenario.retryBackoffUs * Math.pow(2, Math.max(0, attempt - 1))
          : scenario.retryBackoffUs;
        const retryStart = completionEnd;
        const retryEnd = retryStart + retryDelay;
        const retrySegment = createTimelineSegment(
          retryStart,
          retryEnd,
          `Retry backoff ${Math.round(retryDelay)} µs`,
          'retry',
          job.chunkIndex,
          job.segmentIndex,
        );
        if (retrySegment) {
          segments.push(retrySegment);
        }
        events.push({
          timeUs: completionEnd,
          message: `CRC timeout on SSD${laneIndex} chunk ${job.chunkIndex} (attempt ${attempt}) – retrying in ${Math.round(retryDelay)} µs`,
          type: 'warning',
          relatedObject: job.objectIndex,
          laneId,
          chunkIndex: job.chunkIndex,
          attempt,
          deltaUs: Math.round(retryDelay),
        });
        runbook.push({
          id: `${laneId}-${job.objectIndex}-${job.chunkIndex}-${attempt}`,
          timeUs: completionEnd,
          objectIndex: job.objectIndex,
          laneId,
          chunkIndex: job.chunkIndex,
          attempt,
          retryDelayUs: retryDelay,
          additionalLatencyUs: retryDelay + attemptDuration,
          message: `Retry scheduled after ${Math.round(retryDelay)} µs backoff`,
        });
        issueCursor = Math.max(issueCursor, retryEnd);
        lastCompletionEnd = retryEnd;
        continue;
      }

      success = true;
      if (retriesForJob > 0) {
        retries += retriesForJob;
      }
      completions.push({
        objectIndex: job.objectIndex,
        chunkIndex: job.chunkIndex,
        stripeIndex: job.stripeIndex,
        laneIndex,
        completionTimeUs: completionEnd,
      });
      lastCompletionEnd = completionEnd;
    }
  }

  const lane: TimelineLane = {
    id: laneId,
    label: `SSD${laneIndex}`,
    role: 'ssd',
    segments,
    totalUs: laneTotal,
    isCritical: false,
  };

  return {
    lane,
    completions,
    events,
    runbook,
    occupancyEvents,
    failures,
    retries,
  };
};

const computePercentile = (values: number[], percentile: number): number => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[index];
};

const computeStandardDeviation = (values: number[]): number => {
  if (values.length <= 1) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) * (value - mean), 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
};

const buildCalibrationSummary = (scenario: EnterpriseScenario): SimulationCalibrationSummary | undefined => {
  const calibration = scenario.calibration;
  if (!calibration) {
    return undefined;
  }
  const warnings = [...(calibration.warnings ?? [])];
  if ((calibration.sampleCount ?? 0) > 0 && (calibration.sampleCount ?? 0) < 1000) {
    warnings.push('Calibration sample size below 1k commands; confidence may be weak.');
  }
  if (calibration.sigmaPer4kUs === undefined || calibration.sigmaPer4kUs < 0) {
    warnings.push('Calibration σ missing – jitter falls back to scenario input.');
  }
  return {
    profileId: calibration.profileId ?? null,
    label: calibration.label,
    device: calibration.device,
    firmware: calibration.firmware,
    source: calibration.source,
    sampleCount: calibration.sampleCount,
    tolerancePercent: calibration.tolerancePercent,
    warnings,
    applied: Boolean(calibration.profileId),
    useProfileDefaults: Boolean(calibration.useProfileDefaults),
    muPer4kUs: calibration.muPer4kUs,
    sigmaPer4kUs: calibration.sigmaPer4kUs,
  };
};

const computeConfidence = (
  scenario: EnterpriseScenario,
  derived: SimulationDerived,
  objectLatencies: number[],
  kpis: SimulationKPIs,
): KPIConfidenceSet | undefined => {
  const calibration = scenario.calibration;
  if (!calibration || !calibration.sampleCount || calibration.sampleCount <= 0) {
    return undefined;
  }
  if (!objectLatencies.length) {
    return undefined;
  }
  const observedObjectCount = objectLatencies.length;
  const stdDev = computeStandardDeviation(objectLatencies);
  if (!Number.isFinite(stdDev) || stdDev === 0) {
    return undefined;
  }

  const commandsPerObject = Math.max(derived.commandsPerObject, 1);
  const calibrationSampleCount = Math.max(1, Math.round(calibration.sampleCount));
  const estimatedObjectCount = Math.max(
    observedObjectCount,
    Math.floor(calibrationSampleCount / commandsPerObject),
  );
  if (estimatedObjectCount <= 1) {
    return undefined;
  }

  const z = 1.96; // 95% confidence interval
  const observedMargin = (stdDev / Math.sqrt(observedObjectCount)) * z;
  if (!Number.isFinite(observedMargin) || observedMargin <= 0) {
    return undefined;
  }
  const scale = Math.sqrt(observedObjectCount / estimatedObjectCount);
  const adjustedMargin = observedMargin * scale;

  const buildInterval = (value: number, multiplier: number): KPIConfidenceInterval => {
    const margin = adjustedMargin * multiplier;
    return {
      margin,
      lower: Math.max(0, value - margin),
      upper: value + margin,
    };
  };

  const multiplierForPercentile = (percentile: number): number => {
    if (percentile >= 99) {
      return 2.1;
    }
    if (percentile >= 95) {
      return 1.4;
    }
    return 1.0;
  };

  const latencyInterval = buildInterval(kpis.latencyUs, 1.0);
  const throughputMargin = kpis.latencyUs > 0
    ? (kpis.throughputObjsPerSec * (latencyInterval.margin / kpis.latencyUs))
    : 0;

  return {
    confidenceLevel: 0.95,
    sampleCount: calibrationSampleCount,
    objectCount: estimatedObjectCount,
    source: 'calibration',
    p50: buildInterval(kpis.p50Us, multiplierForPercentile(50)),
    p95: buildInterval(kpis.p95Us, multiplierForPercentile(95)),
    p99: buildInterval(kpis.p99Us, multiplierForPercentile(99)),
    latency: latencyInterval,
    throughput: {
      margin: throughputMargin,
      lower: Math.max(0, kpis.throughputObjsPerSec - throughputMargin),
      upper: kpis.throughputObjsPerSec + throughputMargin,
    },
  };
};

const buildHeatmapLane = (
  id: string,
  label: string,
  role: 'ssd' | 'aggregator' | 'host',
  events: OccupancyEvent[],
  totalUs: number,
): QueueHeatmapLane => {
  const sorted = [...events].sort((a, b) => a.timeUs - b.timeUs || a.delta - b.delta);
  const samples: QueueHeatmapSample[] = [];
  let occupancy = 0;
  let lastTime = 0;
  samples.push({ timeUs: 0, occupancy: 0 });
  for (const event of sorted) {
    if (event.timeUs > lastTime) {
      samples.push({ timeUs: event.timeUs, occupancy });
      lastTime = event.timeUs;
    }
    occupancy = Math.max(0, occupancy + event.delta);
    samples.push({ timeUs: event.timeUs, occupancy });
  }
  if (lastTime < totalUs) {
    samples.push({ timeUs: totalUs, occupancy });
  }
  const peak = samples.reduce((max, sample) => Math.max(max, sample.occupancy), 0);
  return { id, label, role, samples, peak };
};

const buildAggregationTree = (
  scenario: EnterpriseScenario,
  stripes: number,
  aggregatorPerStripeUs: number,
  ssdAggregationTotalUs: number,
  pipelineFillUs?: number,
  steadyStateUs?: number,
  serialStageEstimate?: number,
): AggregationTree => {
  if (scenario.solution === 's1') {
    const stages: AggregationTreeStage[] = [];
    for (let level = 0; level < scenario.stripeWidth; level++) {
      stages.push({
        id: `serial-${level}`,
        level,
        label: `Seed SSD${level}`,
        fanIn: 1,
        durationUs: serialStageEstimate ?? 0,
        nodes: 1,
      });
    }
    return {
      location: 'serial',
      totalUs: Math.max(pipelineFillUs ?? 0, steadyStateUs ?? 0),
      depth: stages.length,
      stages,
    };
  }

  if (scenario.solution === 's2') {
    const stages: AggregationTreeStage[] = [];
    let active = scenario.stripeWidth;
    let level = 0;
    const depth = Math.max(1, Math.ceil(log2Safe(active)));
    const perStage = depth > 0 ? aggregatorPerStripeUs / depth : aggregatorPerStripeUs;
    while (active > 1) {
      const nodes = Math.ceil(active / 2);
      stages.push({
        id: `host-${level}`,
        level,
        label: `Host combine stage ${level + 1}`,
        fanIn: Math.min(2, active),
        durationUs: perStage,
        nodes,
      });
      active = Math.ceil(active / 2);
      level += 1;
    }
    if (stages.length === 0) {
      stages.push({
        id: 'host-0',
        level: 0,
        label: 'Host combine',
        fanIn: scenario.stripeWidth,
        durationUs: aggregatorPerStripeUs,
        nodes: 1,
      });
    }
    return {
      location: 'host',
      totalUs: aggregatorPerStripeUs,
      depth: stages.length,
      stages,
    };
  }

  return {
    location: 'ssd',
    totalUs: ssdAggregationTotalUs,
    depth: 1,
    stages: [
      {
        id: 'ssd-agg',
        level: 0,
        label: scenario.aggregatorPolicy === 'roundRobin' ? 'SSD combine (round-robin)' : 'SSD combine (pinned)',
        fanIn: scenario.stripeWidth,
        durationUs: aggregatorPerStripeUs,
        nodes: stripes,
      },
    ],
    policy: scenario.aggregatorPolicy,
  };
};

const aggregateLaneResults = (
  laneResults: LaneSimulationResult[],
): {
  lanes: TimelineLane[];
  completions: CommandCompletion[];
  events: EventLogEntry[];
  runbook: RunbookEntry[];
  occupancy: Record<string, OccupancyEvent[]>;
  failures: number;
  retries: number;
} => {
  const lanes: TimelineLane[] = [];
  const completions: CommandCompletion[] = [];
  const events: EventLogEntry[] = [];
  const runbook: RunbookEntry[] = [];
  const occupancy: Record<string, OccupancyEvent[]> = {};
  let failures = 0;
  let retries = 0;

  for (const result of laneResults) {
    lanes.push(result.lane);
    completions.push(...result.completions);
    events.push(...result.events);
    runbook.push(...result.runbook);
    occupancy[result.lane.id] = (occupancy[result.lane.id] || []).concat(result.occupancyEvents);
    failures += result.failures;
    retries += result.retries;
  }

  return { lanes, completions, events, runbook, occupancy, failures, retries };
};

const simulateSerial = (
  scenario: EnterpriseScenario,
  fileBytes: number,
  chunkBytes: number,
  chunkInfos: ChunkInfo[],
  rng: () => number,
): SimulationResult => {
  const events: EventLogEntry[] = [
    {
      timeUs: 0,
      message: 'Seeded serial CRC pipeline – commands execute strictly in order.',
      type: 'info',
    },
  ];

  const commandsPerObject = chunkInfos.reduce((sum, chunk) => sum + chunk.segments.length, 0);

  const lanes: TimelineLane[] = Array.from({ length: scenario.stripeWidth }, (_, laneIndex) => ({
    id: `ssd-${laneIndex}`,
    label: `SSD${laneIndex}`,
    role: 'ssd',
    segments: [],
    totalUs: 0,
    isCritical: false,
  }));

  const occupancy: Record<string, OccupancyEvent[]> = {};
  lanes.forEach((lane) => {
    occupancy[lane.id] = [];
  });

  const objectLatencies: number[] = [];
  const runbook: RunbookEntry[] = [];
  const hostSegments: TimelineSegment[] = [];
  const hostOccupancy: OccupancyEvent[] = [];
  const hostEvents: EventLogEntry[] = [];

  let globalCursor = 0;
  let totalFailures = 0;
  let totalRetries = 0;

  const serviceEstimate = scenario.nvmeLatencyUs * 2 + scenario.crcPer4kUs * (chunkBytes / 4096);
  const stripes = Math.max(1, Math.ceil(chunkInfos.length / scenario.stripeWidth));

  for (let objectIndex = 0; objectIndex < scenario.objectsInFlight; objectIndex++) {
    for (const chunk of chunkInfos) {
      const lane = lanes[chunk.laneIndex];
      const occ = occupancy[lane.id];
      for (let segmentIndex = 0; segmentIndex < chunk.segments.length; segmentIndex++) {
        const bytes = chunk.segments[segmentIndex];
        let attempt = 0;
        let success = false;
        let retriesForCommand = 0;
        while (!success) {
          attempt += 1;
          const issueStart = globalCursor;
          const issueEnd = issueStart + scenario.nvmeLatencyUs;
          const issueSegment = createTimelineSegment(
            issueStart,
            issueEnd,
            `Issue ${Math.round(bytes / 1024)} KiB (try ${attempt})`,
            'io',
            chunk.chunkIndex,
            segmentIndex,
          );
          if (issueSegment) {
            lane.segments.push(issueSegment);
          }
          occ.push({ timeUs: issueStart, delta: 1 });

          const computeStart = issueEnd;
          const computeDuration = sampleServiceTime(scenario, bytes, rng);
          const computeEnd = computeStart + computeDuration;
          const computeSegment = createTimelineSegment(
            computeStart,
            computeEnd,
            `CRC ${Math.round(bytes / 1024)} KiB (try ${attempt})`,
            'compute',
            chunk.chunkIndex,
            segmentIndex,
          );
          if (computeSegment) {
            lane.segments.push(computeSegment);
          }

          const completionStart = computeEnd;
          const completionEnd = completionStart + scenario.nvmeLatencyUs;
          const completionSegment = createTimelineSegment(
            completionStart,
            completionEnd,
            `Completion (try ${attempt})`,
            'io',
            chunk.chunkIndex,
            segmentIndex,
          );
          if (completionSegment) {
            lane.segments.push(completionSegment);
          }
          occ.push({ timeUs: completionEnd, delta: -1 });

          lane.totalUs = Math.max(lane.totalUs, completionEnd);
          globalCursor = completionEnd;

          const isFinalAttempt = attempt >= scenario.retryMaxAttempts;
          const failureRoll = rng();
          const failed = !isFinalAttempt && failureRoll < scenario.failureProbability;
          if (failed) {
            totalFailures += 1;
            totalRetries += 1;
            retriesForCommand += 1;
            const retryDelay = scenario.retryPolicy === 'exponential'
              ? scenario.retryBackoffUs * Math.pow(2, Math.max(0, attempt - 1))
              : scenario.retryBackoffUs;
            const retryStart = completionEnd;
            const retryEnd = retryStart + retryDelay;
            const retrySegment = createTimelineSegment(
              retryStart,
              retryEnd,
              `Retry backoff ${Math.round(retryDelay)} µs`,
              'retry',
              chunk.chunkIndex,
              segmentIndex,
            );
            if (retrySegment) {
              lane.segments.push(retrySegment);
            }
            events.push({
              timeUs: completionEnd,
              message: `CRC timeout on SSD${chunk.laneIndex} chunk ${chunk.chunkIndex} (attempt ${attempt}) – retrying in ${Math.round(retryDelay)} µs`,
              type: 'warning',
              relatedObject: objectIndex,
              laneId: lane.id,
              chunkIndex: chunk.chunkIndex,
              attempt,
              deltaUs: Math.round(retryDelay),
            });
            runbook.push({
              id: `${lane.id}-${objectIndex}-${chunk.chunkIndex}-${attempt}`,
              timeUs: completionEnd,
              objectIndex,
              laneId: lane.id,
              chunkIndex: chunk.chunkIndex,
              attempt,
              retryDelayUs: retryDelay,
              additionalLatencyUs: retryDelay + computeDuration + scenario.nvmeLatencyUs * 2,
              message: `Retry scheduled after ${Math.round(retryDelay)} µs backoff`,
            });
            globalCursor = retryEnd;
            continue;
          }

          if (retriesForCommand > 0) {
            totalRetries += retriesForCommand;
          }
          success = true;
        }
      }
    }

    const finalizeStart = globalCursor;
    const finalizeEnd = finalizeStart + scenario.orchestrationOverheadUs;
    const finalizeSegment = createTimelineSegment(
      finalizeStart,
      finalizeEnd,
      `Validation · Object ${objectIndex + 1}`,
      'finalize',
    );
    if (finalizeSegment) {
      hostSegments.push(finalizeSegment);
      hostOccupancy.push({ timeUs: finalizeStart, delta: 1 });
      hostOccupancy.push({ timeUs: finalizeEnd, delta: -1 });
    }
    hostEvents.push({
      timeUs: finalizeEnd,
      message: `Validation complete for object ${objectIndex + 1}.`,
      type: 'info',
      relatedObject: objectIndex,
    });
    objectLatencies.push(finalizeEnd);
    globalCursor = finalizeEnd;
  }

  const hostLane: TimelineLane = {
    id: 'host',
    label: 'Host',
    role: 'host',
    segments: hostSegments,
    totalUs: globalCursor,
    isCritical: true,
  };

  const totalLatencyUs = globalCursor;
  const throughputObjsPerSec = totalLatencyUs > 0 ? scenario.objectsInFlight / (totalLatencyUs / 1_000_000) : 0;
  const p50 = computePercentile(objectLatencies, 50);
  const p95 = computePercentile(objectLatencies, 95);
  const p99 = computePercentile(objectLatencies, 99);

  lanes.forEach((lane) => {
    if (lane.totalUs === Math.max(...lanes.map((l) => l.totalUs))) {
      lane.isCritical = true;
    }
  });

  const kpis: SimulationKPIs = {
    latencyUs: totalLatencyUs,
    throughputObjsPerSec,
    p50Us: p50,
    p95Us: p95,
    p99Us: p99,
    criticalPath: [
      {
        label: 'Serial CRC chain',
        valueUs: totalLatencyUs - scenario.orchestrationOverheadUs * scenario.objectsInFlight,
        percent: toPercent(totalLatencyUs - scenario.orchestrationOverheadUs * scenario.objectsInFlight, totalLatencyUs),
      },
      {
        label: 'Orchestration',
        valueUs: scenario.orchestrationOverheadUs * scenario.objectsInFlight,
        percent: toPercent(scenario.orchestrationOverheadUs * scenario.objectsInFlight, totalLatencyUs),
      },
    ],
  };

  const heatmap: QueueHeatmapLane[] = lanes.map((lane) =>
    buildHeatmapLane(lane.id, lane.label, 'ssd', occupancy[lane.id] ?? [], lane.totalUs),
  );
  const hostHeat = buildHeatmapLane('host', 'Host', 'host', hostOccupancy, hostLane.totalUs);
  heatmap.push(hostHeat);

  const aggregationTree = buildAggregationTree(
    scenario,
    stripes,
    0,
    0,
    serviceEstimate * Math.min(scenario.stripeWidth, chunkInfos.length),
    serviceEstimate * chunkInfos.length,
    serviceEstimate,
  );

  const derived: SimulationDerived = {
    fileBytes,
    chunkBytes,
    totalChunks: chunkInfos.length,
    stripes,
    mdtsSegmentsPerChunk: Math.max(...chunkInfos.map((chunk) => chunk.segments.length)),
    mdtsClamp: chunkBytes > scenario.mdtsBytes,
    ssdComputeCriticalPathUs: totalLatencyUs,
    ssdAggregateCriticalPathUs: 0,
    aggregatorTotalUs: 0,
    aggregatorPerStripeUs: 0,
    totalLatencyUs,
    objectLatenciesUs: objectLatencies,
    failures: totalFailures,
    retries: totalRetries,
    randomSeed: scenario.randomSeed,
    aggregatorLocation: 'serial',
    commandsPerObject,
    calibration: buildCalibrationSummary(scenario),
  };

  const confidence = computeConfidence(scenario, derived, objectLatencies, kpis);
  if (confidence) {
    kpis.confidence = confidence;
  }

  return {
    scenario,
    derived,
    lanes: [...lanes, hostLane],
    events: [...events, ...hostEvents].sort((a, b) => a.timeUs - b.timeUs),
    kpis,
    aggregationTree,
    heatmap,
    runbook: runbook.sort((a, b) => a.timeUs - b.timeUs),
  };
};

const simulateParallelHost = (
  scenario: EnterpriseScenario,
  fileBytes: number,
  chunkBytes: number,
  stripes: number,
  chunkInfos: ChunkInfo[],
  rng: () => number,
): SimulationResult => {
  const laneJobs = buildLaneJobs(scenario, chunkInfos, stripes);
  const laneResults = laneJobs.map((jobs, index) => simulateLane(scenario, index, jobs, rng));
  const aggregated = aggregateLaneResults(laneResults);
  const commandsPerObject = chunkInfos.reduce((sum, chunk) => sum + chunk.segments.length, 0);

  const stripeReady: Map<string, number> = new Map();
  const objectReady: number[] = Array.from({ length: scenario.objectsInFlight }, () => 0);

  aggregated.completions.forEach((completion) => {
    const key = `${completion.objectIndex}:${completion.stripeIndex}`;
    const existing = stripeReady.get(key) ?? 0;
    const updated = Math.max(existing, completion.completionTimeUs);
    stripeReady.set(key, updated);
    objectReady[completion.objectIndex] = Math.max(objectReady[completion.objectIndex], completion.completionTimeUs);
  });

  const aggregatorPerStripeUs = scenario.hostCoefficients.c0 +
    scenario.hostCoefficients.c1 * scenario.stripeWidth +
    scenario.hostCoefficients.c2 * log2Safe(scenario.stripeWidth);
  const aggregatorPerObjectUs = aggregatorPerStripeUs * stripes;

  const hostSegments: TimelineSegment[] = [];
  const hostOccupancy: OccupancyEvent[] = [];
  const hostEvents: EventLogEntry[] = [];
  const objectLatencies: number[] = [];

  let hostCursor = 0;
  for (let objectIndex = 0; objectIndex < scenario.objectsInFlight; objectIndex++) {
    const computeReady = objectReady[objectIndex] ?? 0;
    const aggregationStart = Math.max(computeReady, hostCursor);
    const aggregationEnd = aggregationStart + aggregatorPerObjectUs;
    if (aggregatorPerObjectUs > 0) {
      const aggSegment = createTimelineSegment(
        aggregationStart,
        aggregationEnd,
        `Host aggregation · Object ${objectIndex + 1}`,
        'aggregation',
      );
      if (aggSegment) {
        hostSegments.push(aggSegment);
        hostOccupancy.push({ timeUs: aggregationStart, delta: 1 });
        hostOccupancy.push({ timeUs: aggregationEnd, delta: -1 });
      }
      hostEvents.push({
        timeUs: aggregationStart,
        message: `Host begins aggregation for object ${objectIndex + 1}.`,
        type: 'info',
        relatedObject: objectIndex,
      });
      hostEvents.push({
        timeUs: aggregationEnd,
        message: `Host aggregation complete for object ${objectIndex + 1}.`,
        type: 'info',
        relatedObject: objectIndex,
      });
    }
    hostCursor = aggregationEnd;
    const finalizeStart = hostCursor;
    const finalizeEnd = finalizeStart + scenario.orchestrationOverheadUs;
    const finalizeSegment = createTimelineSegment(
      finalizeStart,
      finalizeEnd,
      `Validation · Object ${objectIndex + 1}`,
      'finalize',
    );
    if (finalizeSegment) {
      hostSegments.push(finalizeSegment);
      hostOccupancy.push({ timeUs: finalizeStart, delta: 1 });
      hostOccupancy.push({ timeUs: finalizeEnd, delta: -1 });
    }
    hostEvents.push({
      timeUs: finalizeEnd,
      message: `Validation complete for object ${objectIndex + 1}.`,
      type: 'info',
      relatedObject: objectIndex,
    });
    hostCursor = finalizeEnd;
    objectLatencies.push(finalizeEnd);
  }

  const hostLane: TimelineLane = {
    id: 'host',
    label: 'Host',
    role: 'host',
    segments: hostSegments,
    totalUs: hostCursor,
    isCritical: true,
  };

  const lanes = [...aggregated.lanes, hostLane];
  const maxLaneTime = Math.max(...aggregated.lanes.map((lane) => lane.totalUs));
  aggregated.lanes.forEach((lane) => {
    if (lane.totalUs >= maxLaneTime - 1e-6) {
      lane.isCritical = true;
    }
  });

  const totalLatencyUs = hostCursor;
  const throughputObjsPerSec = totalLatencyUs > 0 ? scenario.objectsInFlight / (totalLatencyUs / 1_000_000) : 0;
  const p50 = computePercentile(objectLatencies, 50);
  const p95 = computePercentile(objectLatencies, 95);
  const p99 = computePercentile(objectLatencies, 99);

  const computeCriticalUs = Math.max(...objectReady);
  const aggregationTotalUs = aggregatorPerObjectUs * scenario.objectsInFlight;
  const orchestrationTotalUs = scenario.orchestrationOverheadUs * scenario.objectsInFlight;

  const kpis: SimulationKPIs = {
    latencyUs: totalLatencyUs,
    throughputObjsPerSec,
    p50Us: p50,
    p95Us: p95,
    p99Us: p99,
    criticalPath: [
      {
        label: 'SSD fan-out',
        valueUs: computeCriticalUs,
        percent: toPercent(computeCriticalUs, totalLatencyUs),
      },
      {
        label: 'Host aggregation',
        valueUs: aggregationTotalUs,
        percent: toPercent(aggregationTotalUs, totalLatencyUs),
      },
      {
        label: 'Orchestration',
        valueUs: orchestrationTotalUs,
        percent: toPercent(orchestrationTotalUs, totalLatencyUs),
      },
    ],
  };

  const heatmap: QueueHeatmapLane[] = [...Object.entries(aggregated.occupancy).map(([id, events]) => {
    const lane = aggregated.lanes.find((l) => l.id === id);
    return buildHeatmapLane(id, lane?.label ?? id, 'ssd', events, lane?.totalUs ?? totalLatencyUs);
  })];
  heatmap.push(buildHeatmapLane('host', 'Host', 'host', hostOccupancy, hostCursor));

  const aggregationTree = buildAggregationTree(
    scenario,
    stripes,
    aggregatorPerStripeUs,
    0,
  );

  const derived: SimulationDerived = {
    fileBytes,
    chunkBytes,
    totalChunks: chunkInfos.length,
    stripes,
    mdtsSegmentsPerChunk: Math.max(...chunkInfos.map((chunk) => chunk.segments.length)),
    mdtsClamp: chunkBytes > scenario.mdtsBytes,
    ssdComputeCriticalPathUs: computeCriticalUs,
    ssdAggregateCriticalPathUs: 0,
    aggregatorTotalUs: aggregationTotalUs,
    aggregatorPerStripeUs,
    totalLatencyUs,
    objectLatenciesUs: objectLatencies,
    failures: aggregated.failures,
    retries: aggregated.retries,
    randomSeed: scenario.randomSeed,
    aggregatorLocation: 'host',
    commandsPerObject,
    calibration: buildCalibrationSummary(scenario),
  };

  const confidence = computeConfidence(scenario, derived, objectLatencies, kpis);
  if (confidence) {
    kpis.confidence = confidence;
  }

  const allEvents = [...aggregated.events, ...hostEvents].sort((a, b) => a.timeUs - b.timeUs);
  const runbook = aggregated.runbook.sort((a, b) => a.timeUs - b.timeUs);

  return {
    scenario,
    derived,
    lanes,
    events: allEvents,
    kpis,
    aggregationTree,
    heatmap,
    runbook,
  };
};

const simulateParallelSsd = (
  scenario: EnterpriseScenario,
  fileBytes: number,
  chunkBytes: number,
  stripes: number,
  chunkInfos: ChunkInfo[],
  rng: () => number,
): SimulationResult => {
  const laneJobs = buildLaneJobs(scenario, chunkInfos, stripes);
  const laneResults = laneJobs.map((jobs, index) => simulateLane(scenario, index, jobs, rng));
  const aggregated = aggregateLaneResults(laneResults);
  const commandsPerObject = chunkInfos.reduce((sum, chunk) => sum + chunk.segments.length, 0);

  const stripeReady: Map<string, number> = new Map();
  const objectComputeReady: number[] = Array.from({ length: scenario.objectsInFlight }, () => 0);

  aggregated.completions.forEach((completion) => {
    const key = `${completion.objectIndex}:${completion.stripeIndex}`;
    const existing = stripeReady.get(key) ?? 0;
    const updated = Math.max(existing, completion.completionTimeUs);
    stripeReady.set(key, updated);
    objectComputeReady[completion.objectIndex] = Math.max(objectComputeReady[completion.objectIndex], completion.completionTimeUs);
  });

  const aggregatorPerStripeUs = scenario.ssdCoefficients.d0 + scenario.ssdCoefficients.d1 * scenario.stripeWidth;
  const aggregatorEvents: EventLogEntry[] = [];
  const aggregatorOccupancy: Record<string, OccupancyEvent[]> = {};
  aggregated.lanes.forEach((lane) => {
    aggregatorOccupancy[lane.id] = aggregatorOccupancy[lane.id] || [];
  });

  const aggregatorLaneCursor: number[] = Array.from({ length: scenario.stripeWidth }, () => 0);
  const stripeOrder: { objectIndex: number; stripeIndex: number }[] = [];
  for (let objectIndex = 0; objectIndex < scenario.objectsInFlight; objectIndex++) {
    for (let stripeIndex = 0; stripeIndex < stripes; stripeIndex++) {
      stripeOrder.push({ objectIndex, stripeIndex });
    }
  }

  const objectAggregatedReady: number[] = Array.from({ length: scenario.objectsInFlight }, () => 0);

  stripeOrder.forEach(({ objectIndex, stripeIndex }) => {
    const readyKey = `${objectIndex}:${stripeIndex}`;
    const stripeReadyTime = stripeReady.get(readyKey) ?? 0;
    const aggregatorLaneIndex = scenario.aggregatorPolicy === 'roundRobin'
      ? (objectIndex * stripes + stripeIndex) % scenario.stripeWidth
      : 0;
    const lane = aggregated.lanes[aggregatorLaneIndex];
    if (!lane) {
      return;
    }
    const laneCursor = aggregatorLaneCursor[aggregatorLaneIndex];
    const startUs = Math.max(laneCursor, stripeReadyTime);
    const endUs = startUs + aggregatorPerStripeUs;
    const aggregationSegment = createTimelineSegment(
      startUs,
      endUs,
      `SSD aggregation · Stripe ${stripeIndex + 1} (object ${objectIndex + 1})`,
      'aggregation',
    );
    if (aggregationSegment) {
      lane.segments.push(aggregationSegment);
    }
    lane.totalUs = Math.max(lane.totalUs, endUs);
    aggregatorLaneCursor[aggregatorLaneIndex] = endUs;
    aggregatorEvents.push({
      timeUs: startUs,
      message: `SSD${aggregatorLaneIndex} aggregates stripe ${stripeIndex + 1} for object ${objectIndex + 1}.`,
      type: 'info',
      relatedObject: objectIndex,
      laneId: lane.id,
    });
    aggregatorOccupancy[lane.id] = aggregatorOccupancy[lane.id] || [];
    aggregatorOccupancy[lane.id].push({ timeUs: startUs, delta: 1 });
    aggregatorOccupancy[lane.id].push({ timeUs: endUs, delta: -1 });
    objectAggregatedReady[objectIndex] = Math.max(objectAggregatedReady[objectIndex], endUs);
  });

  const hostSegments: TimelineSegment[] = [];
  const hostOccupancy: OccupancyEvent[] = [];
  const hostEvents: EventLogEntry[] = [];
  const objectLatencies: number[] = [];
  let hostCursor = 0;

  for (let objectIndex = 0; objectIndex < scenario.objectsInFlight; objectIndex++) {
    const aggregatedReady = objectAggregatedReady[objectIndex] ?? objectComputeReady[objectIndex];
    const finalizeStart = Math.max(aggregatedReady, hostCursor);
    const finalizeEnd = finalizeStart + scenario.orchestrationOverheadUs;
    const finalizeSegment = createTimelineSegment(
      finalizeStart,
      finalizeEnd,
      `Validation · Object ${objectIndex + 1}`,
      'finalize',
    );
    if (finalizeSegment) {
      hostSegments.push(finalizeSegment);
      hostOccupancy.push({ timeUs: finalizeStart, delta: 1 });
      hostOccupancy.push({ timeUs: finalizeEnd, delta: -1 });
    }
    hostEvents.push({
      timeUs: finalizeEnd,
      message: `Validation complete for object ${objectIndex + 1}.`,
      type: 'info',
      relatedObject: objectIndex,
    });
    hostCursor = finalizeEnd;
    objectLatencies.push(finalizeEnd);
  }

  const hostLane: TimelineLane = {
    id: 'host',
    label: 'Host',
    role: 'host',
    segments: hostSegments,
    totalUs: hostCursor,
    isCritical: true,
  };

  const lanes = [...aggregated.lanes, hostLane];
  const overallComputeFinish = Math.max(...objectComputeReady);
  const overallAggregationFinish = Math.max(...objectAggregatedReady);
  const ssdAggregateCriticalPathUs = Math.max(0, overallAggregationFinish - overallComputeFinish);
  const totalLatencyUs = hostCursor;
  const throughputObjsPerSec = totalLatencyUs > 0 ? scenario.objectsInFlight / (totalLatencyUs / 1_000_000) : 0;
  const p50 = computePercentile(objectLatencies, 50);
  const p95 = computePercentile(objectLatencies, 95);
  const p99 = computePercentile(objectLatencies, 99);

  const kpis: SimulationKPIs = {
    latencyUs: totalLatencyUs,
    throughputObjsPerSec,
    p50Us: p50,
    p95Us: p95,
    p99Us: p99,
    criticalPath: [
      {
        label: 'SSD fan-out',
        valueUs: overallComputeFinish,
        percent: toPercent(overallComputeFinish, totalLatencyUs),
      },
      {
        label: 'SSD aggregation',
        valueUs: ssdAggregateCriticalPathUs,
        percent: toPercent(ssdAggregateCriticalPathUs, totalLatencyUs),
      },
      {
        label: 'Orchestration',
        valueUs: scenario.orchestrationOverheadUs * scenario.objectsInFlight,
        percent: toPercent(scenario.orchestrationOverheadUs * scenario.objectsInFlight, totalLatencyUs),
      },
    ],
  };

  const heatmap: QueueHeatmapLane[] = [...Object.entries(aggregated.occupancy).map(([id, events]) => {
    const lane = aggregated.lanes.find((l) => l.id === id);
    return buildHeatmapLane(id, lane?.label ?? id, 'ssd', [...events, ...(aggregatorOccupancy[id] ?? [])], lane?.totalUs ?? totalLatencyUs);
  })];
  heatmap.push(buildHeatmapLane('host', 'Host', 'host', hostOccupancy, hostCursor));

  const aggregationTree = buildAggregationTree(
    scenario,
    stripes,
    aggregatorPerStripeUs,
    aggregatorPerStripeUs * stripes,
  );

  const derived: SimulationDerived = {
    fileBytes,
    chunkBytes,
    totalChunks: chunkInfos.length,
    stripes,
    mdtsSegmentsPerChunk: Math.max(...chunkInfos.map((chunk) => chunk.segments.length)),
    mdtsClamp: chunkBytes > scenario.mdtsBytes,
    ssdComputeCriticalPathUs: overallComputeFinish,
    ssdAggregateCriticalPathUs,
    aggregatorTotalUs: aggregatorPerStripeUs * stripes * scenario.objectsInFlight,
    aggregatorPerStripeUs,
    totalLatencyUs,
    objectLatenciesUs: objectLatencies,
    failures: aggregated.failures,
    retries: aggregated.retries,
    randomSeed: scenario.randomSeed,
    aggregatorLocation: 'ssd',
    commandsPerObject,
    calibration: buildCalibrationSummary(scenario),
  };

  const confidence = computeConfidence(scenario, derived, objectLatencies, kpis);
  if (confidence) {
    kpis.confidence = confidence;
  }

  const allEvents = [...aggregated.events, ...aggregatorEvents, ...hostEvents].sort((a, b) => a.timeUs - b.timeUs);
  const runbook = aggregated.runbook.sort((a, b) => a.timeUs - b.timeUs);

  return {
    scenario,
    derived,
    lanes,
    events: allEvents,
    kpis,
    aggregationTree,
    heatmap,
    runbook,
  };
};

export const simulateEnterprise = (inputScenario: EnterpriseScenario): SimulationResult => {
  const scenario = normaliseScenario(inputScenario);
  const fileBytes = toBytes(scenario.fileSizeMB);
  const chunkBytes = toChunkBytes(scenario.chunkSizeKB);
  const chunkInfos = buildChunkInfos(scenario, fileBytes, chunkBytes);
  const stripes = Math.max(1, Math.ceil(chunkInfos.length / scenario.stripeWidth));
  const rng = createRng(scenario.randomSeed);

  if (scenario.solution === 's1') {
    return simulateSerial(scenario, fileBytes, chunkBytes, chunkInfos, rng);
  }

  if (scenario.solution === 's2') {
    return simulateParallelHost(scenario, fileBytes, chunkBytes, stripes, chunkInfos, rng);
  }

  return simulateParallelSsd(scenario, fileBytes, chunkBytes, stripes, chunkInfos, rng);
};
