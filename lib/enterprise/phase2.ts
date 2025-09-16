export type TimelineSegmentKind = 'io' | 'compute' | 'aggregation' | 'finalize';

export type EnterpriseSolution = 's1' | 's2' | 's3';
export type AggregatorPolicy = 'pinned' | 'roundRobin';

export interface HostCoefficients {
  c0: number;
  c1: number;
  c2: number;
}

export interface SsdCoefficients {
  d0: number;
  d1: number;
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
  orchestrationOverheadUs: number;
  mdtsBytes: number;
  solution: EnterpriseSolution;
  aggregatorPolicy: AggregatorPolicy;
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
  pipelineFillUs?: number;
  steadyStateUs?: number;
  aggregatorLocation: AggregationLocation;
}

export interface SimulationResult {
  scenario: EnterpriseScenario;
  derived: SimulationDerived;
  lanes: TimelineLane[];
  events: EventLogEntry[];
  kpis: SimulationKPIs;
  aggregationTree: AggregationTree;
}

export const ENTERPRISE_PHASE2_PRESET: EnterpriseScenario = {
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
  ssdCoefficients: {
    d0: 64,
    d1: 2.2,
  },
  nvmeLatencyUs: 12,
  crcPer4kUs: 95,
  orchestrationOverheadUs: 18,
  mdtsBytes: 128 * 1024,
  solution: 's2',
  aggregatorPolicy: 'pinned',
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

const createChunkSchedule = (
  bytes: number,
  scenario: EnterpriseScenario,
  chunkIndex: number,
): ChunkSchedule => {
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

    // Deterministic spacer for legibility
    cursor += 1;
  }

  return {
    segments,
    durationUs: cursor,
    mdtsSegments: segmentCount,
  };
};

const normaliseScenario = (scenario: EnterpriseScenario): EnterpriseScenario => {
  const solution: EnterpriseSolution = ['s1', 's2', 's3'].includes(scenario.solution)
    ? scenario.solution
    : 's2';
  const aggregatorPolicy: AggregatorPolicy = scenario.aggregatorPolicy === 'roundRobin' ? 'roundRobin' : 'pinned';

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
    ssdCoefficients: {
      d0: clamp(scenario.ssdCoefficients.d0, 0, 200),
      d1: clamp(scenario.ssdCoefficients.d1, 0, 20),
    },
    nvmeLatencyUs: clamp(scenario.nvmeLatencyUs, 1, 200),
    crcPer4kUs: clamp(scenario.crcPer4kUs, 1, 500),
    orchestrationOverheadUs: clamp(scenario.orchestrationOverheadUs, 0, 200),
    mdtsBytes: clamp(Math.round(scenario.mdtsBytes), 4096, 16 * 1024 * 1024),
    solution,
    aggregatorPolicy,
  };
};

const buildParallelLanes = (
  scenario: EnterpriseScenario,
  fileBytes: number,
  chunkBytes: number,
  totalChunks: number,
  stripes: number,
): {
  lanes: TimelineLane[];
  laneTotals: number[];
  stripeCompletion: number[];
  mdtsSegments: number[];
} => {
  const lanes: TimelineLane[] = [];
  const laneTotals: number[] = [];
  const stripeCompletion: number[] = Array.from({ length: stripes }, () => 0);
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
      stripeCompletion[stripeIndex] = Math.max(stripeCompletion[stripeIndex], laneCursor);
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

  return { lanes, laneTotals, stripeCompletion, mdtsSegments };
};

const buildSerialLanes = (
  scenario: EnterpriseScenario,
  fileBytes: number,
  chunkBytes: number,
  totalChunks: number,
): {
  lanes: TimelineLane[];
  mdtsSegments: number[];
  serialCursor: number;
} => {
  const laneSegments: TimelineSegment[][] = Array.from({ length: scenario.stripeWidth }, () => []);
  const mdtsSegments: number[] = [];
  let serialCursor = 0;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const laneIndex = chunkIndex % scenario.stripeWidth;
    const chunkStartByte = chunkIndex * chunkBytes;
    const chunkRemaining = Math.min(chunkBytes, Math.max(fileBytes - chunkStartByte, 0));
    if (chunkRemaining <= 0) {
      continue;
    }

    const schedule = createChunkSchedule(chunkRemaining, scenario, chunkIndex);
    const translated = schedule.segments.map((segment) => ({
      ...segment,
      startUs: segment.startUs + serialCursor,
      endUs: segment.endUs + serialCursor,
    }));

    laneSegments[laneIndex].push(...translated);
    serialCursor += schedule.durationUs;
    mdtsSegments.push(schedule.mdtsSegments);
  }

  const lanes: TimelineLane[] = laneSegments.map((segments, laneIndex) => {
    const totalUs = segments.reduce((acc, segment) => Math.max(acc, segment.endUs), 0);
    return {
      id: `ssd-${laneIndex}`,
      label: `SSD${laneIndex}`,
      role: 'ssd',
      segments,
      totalUs,
      isCritical: false,
    } as TimelineLane;
  });

  return { lanes, mdtsSegments, serialCursor };
};

const log2Safe = (value: number): number => {
  return Math.log2(Math.max(1, value));
};

const buildAggregationTree = (
  scenario: EnterpriseScenario,
  stripes: number,
  aggregatorPerStripeUs: number,
  ssdAggregationTotalUs: number,
  pipelineFillUs?: number,
  steadyStateUs?: number,
  serialStageDurationUs?: number,
): AggregationTree => {
  if (scenario.solution === 's1') {
    const stages: AggregationTreeStage[] = [];
    for (let index = 0; index < scenario.stripeWidth; index++) {
      stages.push({
        id: `serial-${index}`,
        level: index,
        label: `Seed SSD${index}`,
        fanIn: 1,
        durationUs: serialStageDurationUs ?? 0,
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
    const slice = depth > 0 ? aggregatorPerStripeUs / depth : aggregatorPerStripeUs;
    while (active > 1) {
      const nodes = Math.ceil(active / 2);
      stages.push({
        id: `host-${level}`,
        level,
        label: `Host combine (stage ${level + 1})`,
        fanIn: Math.min(2, active),
        durationUs: slice,
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

  // S3
  return {
    location: 'ssd',
    totalUs: ssdAggregationTotalUs,
    depth: 1,
    stages: [
      {
        id: 'ssd-0',
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

const toPercent = (value: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * 100;
};

export const simulateEnterprise = (inputScenario: EnterpriseScenario): SimulationResult => {
  const scenario = normaliseScenario(inputScenario);
  const fileBytes = toBytes(scenario.fileSizeMB);
  const chunkBytes = toChunkBytes(scenario.chunkSizeKB);
  const totalChunks = Math.max(1, Math.ceil(fileBytes / chunkBytes));
  const stripes = Math.max(1, Math.ceil(totalChunks / scenario.stripeWidth));

  const events: EventLogEntry[] = [];

  if (scenario.solution === 's1') {
    events.push({
      timeUs: 0,
      message: 'Seeded serial CRC: commands issue one after another using previous CRC as the seed.',
      type: 'info',
    });
  } else {
    events.push({
      timeUs: 0,
      message: `Fan-out ${scenario.stripeWidth} CRC commands in parallel across the stripe.`,
      type: 'info',
    });
  }

  const mdtsClamp = chunkBytes > scenario.mdtsBytes;

  const addMdtsEvent = (segments: number) => {
    events.push({
      timeUs: 0,
      message: `Chunk size ${Math.round(chunkBytes / 1024)} KiB exceeds MDTS ${Math.round(scenario.mdtsBytes / 1024)} KiB – split into ${segments} NVMe commands.`,
      type: 'warning',
    });
  };

  if (scenario.solution === 's1') {
    const { lanes, mdtsSegments, serialCursor } = buildSerialLanes(
      scenario,
      fileBytes,
      chunkBytes,
      totalChunks,
    );

    if (mdtsClamp && mdtsSegments.length > 0) {
      addMdtsEvent(Math.max(...mdtsSegments));
    }

    const baselineSchedule = createChunkSchedule(
      Math.min(chunkBytes, fileBytes),
      scenario,
      0,
    );
    const pipelineFillUs = baselineSchedule.durationUs * Math.min(scenario.stripeWidth, totalChunks);
    const steadyStateUs = baselineSchedule.durationUs * totalChunks;
    const serialComputeUs = Math.max(serialCursor, pipelineFillUs, steadyStateUs);

    const hostStart = serialComputeUs;
    const hostEnd = hostStart + scenario.orchestrationOverheadUs;

    const hostLane: TimelineLane = {
      id: 'host',
      label: 'Host',
      role: 'host',
      segments: [
        {
          startUs: hostStart,
          endUs: hostEnd,
          label: 'Validation + orchestration',
          kind: 'finalize',
        },
      ],
      totalUs: hostEnd,
      isCritical: true,
    };

    const ssdCriticalUs = serialComputeUs;
    let criticalLaneIndex = 0;
    let criticalLaneEnd = 0;
    lanes.forEach((lane, index) => {
      const laneEnd = lane.segments.reduce((acc, segment) => Math.max(acc, segment.endUs), 0);
      lane.totalUs = laneEnd;
      if (laneEnd >= criticalLaneEnd) {
        criticalLaneEnd = laneEnd;
        criticalLaneIndex = index;
      }
    });

    if (lanes[criticalLaneIndex]) {
      lanes[criticalLaneIndex].isCritical = true;
    }

    events.push({
      timeUs: ssdCriticalUs,
      message: 'Serial CRC pipeline drained – final partial CRC ready for host validation.',
      type: 'info',
    });
    events.push({
      timeUs: hostEnd,
      message: 'Object validation complete.',
      type: 'info',
    });

    const totalLatencyUs = hostEnd;
    const throughputObjsPerSec = totalLatencyUs > 0 ? 1_000_000 / totalLatencyUs : 0;

    const kpis: SimulationKPIs = {
      latencyUs: totalLatencyUs,
      throughputObjsPerSec,
      p50Us: totalLatencyUs,
      p95Us: totalLatencyUs,
      p99Us: totalLatencyUs,
      criticalPath: [
        {
          label: 'Serial pipeline',
          valueUs: ssdCriticalUs,
          percent: toPercent(ssdCriticalUs, totalLatencyUs),
        },
        {
          label: 'Orchestration',
          valueUs: scenario.orchestrationOverheadUs,
          percent: toPercent(scenario.orchestrationOverheadUs, totalLatencyUs),
        },
      ],
    };

    const aggregationTree = buildAggregationTree(
      scenario,
      stripes,
      0,
      0,
      pipelineFillUs,
      steadyStateUs,
      baselineSchedule.durationUs,
    );

    return {
      scenario,
      derived: {
        fileBytes,
        chunkBytes,
        totalChunks,
        stripes,
        mdtsSegmentsPerChunk: mdtsSegments.length > 0 ? Math.max(...mdtsSegments) : 1,
        mdtsClamp,
        ssdComputeCriticalPathUs: ssdCriticalUs,
        ssdAggregateCriticalPathUs: 0,
        aggregatorTotalUs: 0,
        aggregatorPerStripeUs: 0,
        totalLatencyUs,
        pipelineFillUs,
        steadyStateUs,
        aggregatorLocation: 'serial',
      },
      lanes: [...lanes, hostLane],
      events,
      kpis,
      aggregationTree,
    };
  }

  // Solutions S2 and S3 (parallel fan-out)
  const { lanes, laneTotals, stripeCompletion, mdtsSegments } = buildParallelLanes(
    scenario,
    fileBytes,
    chunkBytes,
    totalChunks,
    stripes,
  );

  if (mdtsClamp && mdtsSegments.length > 0) {
    addMdtsEvent(Math.max(...mdtsSegments));
  }

  const computeCriticalUs = stripeCompletion.length > 0 ? Math.max(...stripeCompletion) : 0;

  let aggregatorPerStripeUs = 0;
  let aggregatorTotalUs = 0;
  let ssdAggregateCriticalPathUs = 0;
  let hostStart = computeCriticalUs;
  let hostEnd = computeCriticalUs + scenario.orchestrationOverheadUs;
  let aggregatorLocation: AggregationLocation = 'host';

  if (scenario.solution === 's2') {
    aggregatorPerStripeUs = scenario.hostCoefficients.c0 +
      scenario.hostCoefficients.c1 * scenario.stripeWidth +
      scenario.hostCoefficients.c2 * log2Safe(scenario.stripeWidth);
    aggregatorTotalUs = aggregatorPerStripeUs * stripes;
    hostStart = computeCriticalUs;
    const hostAggregationEnd = hostStart + aggregatorTotalUs;
    hostEnd = hostAggregationEnd + scenario.orchestrationOverheadUs;

    events.push({
      timeUs: computeCriticalUs,
      message: 'All SSD CRC results received by host – begin host aggregation.',
      type: 'info',
    });
    events.push({
      timeUs: hostAggregationEnd,
      message: 'Host aggregation complete. Preparing validation.',
      type: 'info',
    });
    events.push({
      timeUs: hostEnd,
      message: 'Object validation complete.',
      type: 'info',
    });

    aggregatorLocation = 'host';

    const hostLane: TimelineLane = {
      id: 'host',
      label: 'Host',
      role: 'host',
      segments: [
        {
          startUs: hostStart,
          endUs: hostAggregationEnd,
          label: 'Host aggregation',
          kind: 'aggregation',
        },
        {
          startUs: hostAggregationEnd,
          endUs: hostEnd,
          label: 'Validation + orchestration',
          kind: 'finalize',
        },
      ],
      totalUs: hostEnd,
      isCritical: true,
    };

    const totalLatencyUs = hostEnd;
    const throughputObjsPerSec = totalLatencyUs > 0 ? 1_000_000 / totalLatencyUs : 0;
    const criticalSSDIndex = laneTotals.findIndex((value) => value === Math.max(...laneTotals));
    if (criticalSSDIndex >= 0 && lanes[criticalSSDIndex]) {
      lanes[criticalSSDIndex].isCritical = true;
    }

    const kpis: SimulationKPIs = {
      latencyUs: totalLatencyUs,
      throughputObjsPerSec,
      p50Us: totalLatencyUs,
      p95Us: totalLatencyUs,
      p99Us: totalLatencyUs,
      criticalPath: [
        {
          label: 'SSD fan-out',
          valueUs: computeCriticalUs,
          percent: toPercent(computeCriticalUs, totalLatencyUs),
        },
        {
          label: 'Host aggregation',
          valueUs: aggregatorTotalUs,
          percent: toPercent(aggregatorTotalUs, totalLatencyUs),
        },
        {
          label: 'Orchestration',
          valueUs: scenario.orchestrationOverheadUs,
          percent: toPercent(scenario.orchestrationOverheadUs, totalLatencyUs),
        },
      ],
    };

    const aggregationTree = buildAggregationTree(
      scenario,
      stripes,
      aggregatorPerStripeUs,
      0,
    );

    return {
      scenario,
      derived: {
        fileBytes,
        chunkBytes,
        totalChunks,
        stripes,
        mdtsSegmentsPerChunk: mdtsSegments.length > 0 ? Math.max(...mdtsSegments) : 1,
        mdtsClamp,
        ssdComputeCriticalPathUs: computeCriticalUs,
        ssdAggregateCriticalPathUs: 0,
        aggregatorTotalUs,
        aggregatorPerStripeUs,
        totalLatencyUs,
        aggregatorLocation,
      },
      lanes: [...lanes, hostLane],
      events,
      kpis,
      aggregationTree,
    };
  }

  // Solution S3 (SSD aggregation)
  aggregatorPerStripeUs = scenario.ssdCoefficients.d0 + scenario.ssdCoefficients.d1 * scenario.stripeWidth;
  aggregatorTotalUs = aggregatorPerStripeUs * stripes;
  aggregatorLocation = 'ssd';

  const laneAggregateTotals = [...laneTotals];
  const aggregatorEvents: EventLogEntry[] = [];

  for (let stripeIndex = 0; stripeIndex < stripes; stripeIndex++) {
    const aggregatorLaneIndex = scenario.aggregatorPolicy === 'roundRobin'
      ? stripeIndex % scenario.stripeWidth
      : 0;

    const lane = lanes[aggregatorLaneIndex];
    if (!lane) {
      continue;
    }

    const currentLaneTotal = laneAggregateTotals[aggregatorLaneIndex] ?? 0;
    const stripeReadyTime = stripeCompletion[stripeIndex] ?? currentLaneTotal;
    const startUs = Math.max(currentLaneTotal, stripeReadyTime);
    const endUs = startUs + aggregatorPerStripeUs;

    lane.segments.push({
      startUs,
      endUs,
      label: `SSD aggregation (stripe ${stripeIndex + 1})`,
      kind: 'aggregation',
      commandIndex: stripeIndex,
    });
    laneAggregateTotals[aggregatorLaneIndex] = endUs;

    aggregatorEvents.push({
      timeUs: startUs,
      message: `SSD${aggregatorLaneIndex} begins aggregation for stripe ${stripeIndex + 1}.`,
      type: 'info',
    });
  }

  lanes.forEach((lane, index) => {
    const updatedTotal = laneAggregateTotals[index] ?? lane.totalUs;
    lane.totalUs = Math.max(lane.totalUs, updatedTotal);
  });

  events.push(...aggregatorEvents);

  const overallComputeFinish = stripeCompletion.length > 0 ? Math.max(...stripeCompletion) : 0;
  const overallLaneFinish = laneAggregateTotals.length > 0 ? Math.max(...laneAggregateTotals) : 0;
  ssdAggregateCriticalPathUs = Math.max(0, overallLaneFinish - overallComputeFinish);
  hostStart = Math.max(overallLaneFinish, overallComputeFinish);
  hostEnd = hostStart + scenario.orchestrationOverheadUs;

  events.push({
    timeUs: hostStart,
    message: 'Aggregated CRC received from SSD – host validation begins.',
    type: 'info',
  });
  events.push({
    timeUs: hostEnd,
    message: 'Object validation complete.',
    type: 'info',
  });

  const hostLane: TimelineLane = {
    id: 'host',
    label: 'Host',
    role: 'host',
    segments: [
      {
        startUs: hostStart,
        endUs: hostEnd,
        label: 'Validation + orchestration',
        kind: 'finalize',
      },
    ],
    totalUs: hostEnd,
    isCritical: true,
  };

  const totalLatencyUs = hostEnd;
  const throughputObjsPerSec = totalLatencyUs > 0 ? 1_000_000 / totalLatencyUs : 0;
  const criticalSSDIndex = laneAggregateTotals.findIndex((value) => value === overallLaneFinish);
  if (criticalSSDIndex >= 0 && lanes[criticalSSDIndex]) {
    lanes[criticalSSDIndex].isCritical = true;
  }

  const kpis: SimulationKPIs = {
    latencyUs: totalLatencyUs,
    throughputObjsPerSec,
    p50Us: totalLatencyUs,
    p95Us: totalLatencyUs,
    p99Us: totalLatencyUs,
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
        valueUs: scenario.orchestrationOverheadUs,
        percent: toPercent(scenario.orchestrationOverheadUs, totalLatencyUs),
      },
    ],
  };

  const aggregationTree = buildAggregationTree(
    scenario,
    stripes,
    aggregatorPerStripeUs,
    aggregatorPerStripeUs * stripes,
  );

  return {
    scenario,
    derived: {
      fileBytes,
      chunkBytes,
      totalChunks,
      stripes,
      mdtsSegmentsPerChunk: mdtsSegments.length > 0 ? Math.max(...mdtsSegments) : 1,
      mdtsClamp,
      ssdComputeCriticalPathUs: overallComputeFinish,
      ssdAggregateCriticalPathUs,
      aggregatorTotalUs,
      aggregatorPerStripeUs,
      totalLatencyUs,
      aggregatorLocation,
    },
    lanes: [...lanes, hostLane],
    events,
    kpis,
    aggregationTree,
  };
};
