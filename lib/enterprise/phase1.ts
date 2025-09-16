export type TimelineSegmentKind = 'io' | 'compute' | 'aggregation' | 'finalize';

export interface Phase1Scenario {
  stripeWidth: number;
  objectsInFlight: number;
  fileSizeMB: number;
  chunkSizeKB: number;
  queueDepth: number;
  threads: number;
  hostCoefficients: {
    c0: number;
    c1: number;
    c2: number;
  };
  nvmeLatencyUs: number;
  crcPer4kUs: number;
  orchestrationOverheadUs: number;
  mdtsBytes: number;
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
  role: 'ssd' | 'host';
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
}

export interface EventLogEntry {
  timeUs: number;
  message: string;
  type: 'info' | 'warning';
}

export interface SimulationDerived {
  fileBytes: number;
  chunkBytes: number;
  totalChunks: number;
  stripes: number;
  mdtsSegmentsPerChunk: number;
  mdtsClamp: boolean;
  ssdCriticalPathUs: number;
  aggregatorUs: number;
  aggregatorPerStripeUs: number;
  totalLatencyUs: number;
}

export interface SimulationResult {
  scenario: Phase1Scenario;
  derived: SimulationDerived;
  lanes: TimelineLane[];
  events: EventLogEntry[];
  kpis: SimulationKPIs;
}

export const ENTERPRISE_PHASE1_PRESET: Phase1Scenario = {
  stripeWidth: 8,
  objectsInFlight: 1,
  fileSizeMB: 32,
  chunkSizeKB: 64,
  queueDepth: 16,
  threads: 8,
  hostCoefficients: {
    c0: 22,
    c1: 1.4,
    c2: 7,
  },
  nvmeLatencyUs: 12,
  crcPer4kUs: 95,
  orchestrationOverheadUs: 18,
  mdtsBytes: 128 * 1024,
};

interface ChunkSchedule {
  segments: TimelineSegment[];
  durationUs: number;
  mdtsSegments: number;
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

const createChunkSchedule = (bytes: number, scenario: Phase1Scenario, chunkIndex: number): ChunkSchedule => {
  const mdts = Math.max(4096, scenario.mdtsBytes);
  const nvme = Math.max(1, scenario.nvmeLatencyUs);
  const per4k = Math.max(1, scenario.crcPer4kUs);

  const segmentCount = Math.ceil(bytes / mdts);
  const segments: TimelineSegment[] = [];
  let cursor = 0;

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
    const remaining = bytes - segmentIndex * mdts;
    const segmentBytes = Math.min(mdts, remaining);

    const issueStart = cursor;
    const issueEnd = issueStart + nvme;
    segments.push({
      startUs: issueStart,
      endUs: issueEnd,
      label: `Issue ${segmentBytes >> 10} KiB`,
      kind: 'io',
      chunkIndex,
      commandIndex: segmentIndex,
    });
    cursor = issueEnd;

    const computeDuration = (segmentBytes / 4096) * per4k;
    const computeStart = cursor;
    const computeEnd = computeStart + computeDuration;
    segments.push({
      startUs: computeStart,
      endUs: computeEnd,
      label: `CRC ${segmentBytes >> 10} KiB`,
      kind: 'compute',
      chunkIndex,
      commandIndex: segmentIndex,
    });
    cursor = computeEnd;

    const completionStart = cursor;
    const completionEnd = completionStart + nvme;
    segments.push({
      startUs: completionStart,
      endUs: completionEnd,
      label: 'Completion',
      kind: 'io',
      chunkIndex,
      commandIndex: segmentIndex,
    });
    cursor = completionEnd;

    // Small deterministic gap before next command dispatch to keep charts readable
    cursor += 1;
  }

  return {
    segments,
    durationUs: cursor,
    mdtsSegments: segmentCount,
  };
};

const normaliseScenario = (scenario: Phase1Scenario): Phase1Scenario => {
  return {
    stripeWidth: clamp(Math.round(scenario.stripeWidth), 1, 64),
    objectsInFlight: clamp(Math.round(scenario.objectsInFlight), 1, 16),
    fileSizeMB: clamp(scenario.fileSizeMB, 0.5, 4096),
    chunkSizeKB: clamp(scenario.chunkSizeKB, 4, 2048),
    queueDepth: clamp(Math.round(scenario.queueDepth), 1, 128),
    threads: clamp(Math.round(scenario.threads), 1, 128),
    hostCoefficients: {
      c0: clamp(scenario.hostCoefficients.c0, 0, 500),
      c1: clamp(scenario.hostCoefficients.c1, 0, 50),
      c2: clamp(scenario.hostCoefficients.c2, 0, 200),
    },
    nvmeLatencyUs: clamp(scenario.nvmeLatencyUs, 1, 200),
    crcPer4kUs: clamp(scenario.crcPer4kUs, 1, 500),
    orchestrationOverheadUs: clamp(scenario.orchestrationOverheadUs, 0, 200),
    mdtsBytes: clamp(Math.round(scenario.mdtsBytes), 4096, 16 * 1024 * 1024),
  };
};

export const simulatePhase1 = (inputScenario: Phase1Scenario): SimulationResult => {
  const scenario = normaliseScenario(inputScenario);
  const fileBytes = toBytes(scenario.fileSizeMB);
  const chunkBytes = toChunkBytes(scenario.chunkSizeKB);
  const totalChunks = Math.max(1, Math.ceil(fileBytes / chunkBytes));
  const stripes = Math.max(1, Math.ceil(totalChunks / scenario.stripeWidth));

  const lanes: TimelineLane[] = [];
  const laneTotals: number[] = [];
  const mdtsSegments: number[] = [];

  for (let laneIndex = 0; laneIndex < scenario.stripeWidth; laneIndex++) {
    const laneId = `ssd-${laneIndex}`;
    const laneSegments: TimelineSegment[] = [];
    let laneCursor = 0;

    for (let stripeIndex = 0; stripeIndex < stripes; stripeIndex++) {
      const chunkIndex = stripeIndex * scenario.stripeWidth + laneIndex;
      if (chunkIndex >= totalChunks) {
        break;
      }

      const chunkStartByte = chunkIndex * chunkBytes;
      const chunkRemaining = Math.min(chunkBytes, Math.max(fileBytes - chunkStartByte, 0));
      if (chunkRemaining <= 0) {
        continue;
      }

      const schedule = createChunkSchedule(chunkRemaining, scenario, chunkIndex);
      const translated = schedule.segments.map((segment) => ({
        ...segment,
        startUs: segment.startUs + laneCursor,
        endUs: segment.endUs + laneCursor,
      }));

      laneSegments.push(...translated);
      laneCursor += schedule.durationUs;
      mdtsSegments.push(schedule.mdtsSegments);
    }

    laneTotals.push(laneCursor);
    lanes.push({
      id: laneId,
      label: `SSD${laneIndex}`,
      role: 'ssd',
      segments: laneSegments,
      totalUs: laneCursor,
      isCritical: false,
    });
  }

  const ssdCriticalPathUs = laneTotals.length > 0 ? Math.max(...laneTotals) : 0;
  const aggregatorPerStripeUs = scenario.hostCoefficients.c0 +
    scenario.hostCoefficients.c1 * scenario.stripeWidth +
    scenario.hostCoefficients.c2 * Math.log2(Math.max(1, scenario.stripeWidth));
  const aggregatorUs = aggregatorPerStripeUs * stripes;

  const hostStart = ssdCriticalPathUs;
  const hostEnd = hostStart + aggregatorUs;
  const validationEnd = hostEnd + scenario.orchestrationOverheadUs;

  const hostLane: TimelineLane = {
    id: 'host',
    label: 'Host',
    role: 'host',
    segments: [
      {
        startUs: hostStart,
        endUs: hostEnd,
        label: 'Host aggregation',
        kind: 'aggregation',
      },
      {
        startUs: hostEnd,
        endUs: validationEnd,
        label: 'Validation + orchestration',
        kind: 'finalize',
      },
    ],
    totalUs: validationEnd,
    isCritical: true,
  };

  const totalLatencyUs = validationEnd;
  const throughputObjsPerSec = totalLatencyUs > 0 ? 1_000_000 / totalLatencyUs : 0;

  const criticalSSDIndex = laneTotals.findIndex((value) => value === ssdCriticalPathUs);
  if (criticalSSDIndex >= 0 && lanes[criticalSSDIndex]) {
    lanes[criticalSSDIndex].isCritical = true;
  }

  const mdtsSegmentsPerChunk = mdtsSegments.length > 0 ? Math.max(...mdtsSegments) : 1;
  const mdtsClamp = chunkBytes > scenario.mdtsBytes;

  const events: EventLogEntry[] = [
    {
      timeUs: 0,
      message: `Dispatch ${scenario.stripeWidth} parallel CRC commands (stripe fan-out).`,
      type: 'info',
    },
  ];

  if (mdtsClamp) {
    events.push({
      timeUs: 0,
      message: `Chunk size ${Math.round(chunkBytes / 1024)} KiB exceeds MDTS ${Math.round(scenario.mdtsBytes / 1024)} KiB – split into ${mdtsSegmentsPerChunk} NVMe commands.`,
      type: 'warning',
    });
  }

  events.push(
    {
      timeUs: ssdCriticalPathUs,
      message: 'All SSD CRC results received by host.',
      type: 'info',
    },
    {
      timeUs: hostStart,
      message: `Host aggregation begins (Agg_host total = ${aggregatorUs.toFixed(1)} µs across ${stripes} stripe${stripes === 1 ? '' : 's'}).`,
      type: 'info',
    },
    {
      timeUs: hostEnd,
      message: 'Host aggregation complete. Preparing validation.',
      type: 'info',
    },
    {
      timeUs: totalLatencyUs,
      message: 'Object validation complete.',
      type: 'info',
    },
  );

  const criticalPath: KPIBreakdown[] = [
    {
      label: 'SSD fan-out',
      valueUs: ssdCriticalPathUs,
      percent: totalLatencyUs > 0 ? (ssdCriticalPathUs / totalLatencyUs) * 100 : 0,
    },
    {
      label: 'Host aggregation',
      valueUs: aggregatorUs,
      percent: totalLatencyUs > 0 ? (aggregatorUs / totalLatencyUs) * 100 : 0,
    },
    {
      label: 'Orchestration',
      valueUs: scenario.orchestrationOverheadUs,
      percent: totalLatencyUs > 0 ? (scenario.orchestrationOverheadUs / totalLatencyUs) * 100 : 0,
    },
  ];

  const kpis: SimulationKPIs = {
    latencyUs: totalLatencyUs,
    throughputObjsPerSec,
    p50Us: totalLatencyUs,
    p95Us: totalLatencyUs,
    p99Us: totalLatencyUs,
    criticalPath,
  };

  return {
    scenario,
    derived: {
      fileBytes,
      chunkBytes,
      totalChunks,
      stripes,
      mdtsSegmentsPerChunk,
      mdtsClamp,
      ssdCriticalPathUs,
      aggregatorUs,
      aggregatorPerStripeUs,
      totalLatencyUs,
    },
    lanes: [...lanes, hostLane],
    events,
    kpis,
  };
};
