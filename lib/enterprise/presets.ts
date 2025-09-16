import type { EnterpriseScenario, EnterprisePresetDefinition } from './types';

export const ENTERPRISE_BASELINE_SCENARIO: EnterpriseScenario = {
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
  crcPer4kUs: 110,
  crcSigmaPer4kUs: 35,
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
  const base = cloneEnterpriseScenario(ENTERPRISE_BASELINE_SCENARIO);
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
