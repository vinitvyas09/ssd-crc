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

export interface SimulationKPIs {
  latencyUs: number;
  throughputObjsPerSec: number;
  p50Us: number;
  p95Us: number;
  p99Us: number;
  criticalPath: KPIBreakdown[];
  confidence?: KPIConfidenceSet;
}

export type AggregationLocation = 'serial' | 'host' | 'ssd';

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

export interface EnterprisePresetDefinition {
  id: string;
  label: string;
  summary: string;
  description?: string;
  scenario: EnterpriseScenario;
}
