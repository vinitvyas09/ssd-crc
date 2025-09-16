import {
  CalibrationProfile,
  ScenarioCalibration,
  EnterpriseScenario,
} from '@/lib/enterprise/phase3';

export interface CalibrationParseOptions {
  label?: string;
  device?: string;
  firmware?: string;
  tolerancePercent?: number;
}

export interface CalibrationParseResult {
  profile: CalibrationProfile;
  warnings: string[];
  avgLatencySamples: number[];
  commandSamples: number[];
}

const AVG_LATENCY_REGEX = /Avg latency\s+(\d+(?:\.\d+)?)\s*(?:usecs|µs|us)\s+per\s+(\d+)\s*B/i;
const CRC_COUNT_REGEX = /(?:\b|\D)(\d+)\/(\d+)\s+CRCs/i;
const QD_REGEX = /(queue\s*depth|queuedepth|QD)\s*(?:=|:)?\s*(\d+)/i;
const THREAD_REGEX = /(threads?|NUM_VERIFY_THREADS)\s*(?:=|:)?\s*(\d+)/i;
const NLB_REGEX = /(read\+?\s?NLB|readplus_nlb|NLB)\s*(?:=|:)?\s*(\d+)/i;
const MDTS_REGEX = /(MDTS|mdts_bytes)\s*(?:=|:)?\s*(\d+)/i;
const CRC_RATE_REGEX = /(\d+(?:\.\d+)?)\s*CRCs\/(?:sec|s)/i;

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

const computeMean = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const computeStdDev = (values: number[]): number => {
  if (values.length <= 1) {
    return 0;
  }
  const mean = computeMean(values);
  const variance = values.reduce((acc, value) => acc + (value - mean) * (value - mean), 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
};

const generateCalibrationId = (): string => {
  const globalCrypto =
    typeof globalThis !== 'undefined' && 'crypto' in globalThis
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  return `cal-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16)}`;
};

const normaliseTolerance = (value?: number): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return clampNumber(Math.round(value), 1, 100);
};

const looksLikeCalibrationProfile = (input: unknown): input is CalibrationProfile => {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.muPer4kUs === 'number' &&
    typeof candidate.sigmaPer4kUs === 'number' &&
    typeof candidate.sampleCount === 'number'
  );
};

const normaliseImportedProfile = (input: CalibrationProfile): CalibrationProfile => {
  const tolerance = normaliseTolerance(input.tolerancePercent) ?? 15;
  return {
    id: input.id ?? generateCalibrationId(),
    label: input.label ?? `Calibration ${new Date().toISOString()}`,
    device: input.device,
    firmware: input.firmware,
    createdAt: input.createdAt ?? new Date().toISOString(),
    source: input.source ?? 'imported',
    muPer4kUs: clampNumber(input.muPer4kUs, 1, 1000),
    sigmaPer4kUs: clampNumber(Math.max(0, input.sigmaPer4kUs), 0, 1000),
    nvmeLatencyUs: clampNumber(input.nvmeLatencyUs ?? 12, 1, 500),
    queueDepth: input.queueDepth,
    threads: input.threads,
    readNlb: input.readNlb,
    mdtsBytes: input.mdtsBytes,
    tolerancePercent: tolerance,
    sampleCount: Math.max(0, Math.round(input.sampleCount)),
    hostCoefficients: input.hostCoefficients,
    ssdCoefficients: input.ssdCoefficients,
    notes: input.notes,
    warnings: Array.isArray(input.warnings) ? [...input.warnings] : undefined,
  };
};

const estimateNvmeLatency = (muPer4kUs: number, commandRates: number[]): number => {
  if (commandRates.length === 0) {
    return clampNumber(muPer4kUs * 0.12, 4, 80);
  }
  // Higher command rate usually means better overlap and lower per-command overhead.
  const peakRate = Math.max(...commandRates);
  if (!Number.isFinite(peakRate) || peakRate <= 0) {
    return clampNumber(muPer4kUs * 0.12, 4, 80);
  }
  const idealLatency = 1_000_000 / peakRate;
  return clampNumber(Math.min(muPer4kUs * 0.25, idealLatency * 0.4), 4, 120);
};

export const profileToScenarioCalibration = (
  profile: CalibrationProfile,
  options?: { useProfileDefaults?: boolean; warnings?: string[] },
): ScenarioCalibration => {
  const warnings = options?.warnings ? [...options.warnings] : [];
  const mdtsBytes = profile.mdtsBytes ?? (profile.readNlb ? profile.readNlb * 4096 : undefined);
  return {
    profileId: profile.id,
    label: profile.label,
    device: profile.device,
    firmware: profile.firmware,
    source: profile.source,
    sampleCount: profile.sampleCount,
    muPer4kUs: profile.muPer4kUs,
    sigmaPer4kUs: profile.sigmaPer4kUs,
    nvmeLatencyUs: profile.nvmeLatencyUs,
    queueDepth: profile.queueDepth,
    threads: profile.threads,
    readNlb: profile.readNlb,
    mdtsBytes,
    tolerancePercent: profile.tolerancePercent ?? 15,
    hostCoefficients: profile.hostCoefficients,
    ssdCoefficients: profile.ssdCoefficients,
    useProfileDefaults: options?.useProfileDefaults ?? true,
    warnings,
  };
};

export const parseCalibrationInput = (
  input: string,
  options?: CalibrationParseOptions,
): CalibrationParseResult => {
  const trimmed = input.trim();
  const warnings: string[] = [];

  if (!trimmed) {
    throw new Error('Calibration input is empty.');
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (looksLikeCalibrationProfile(parsed)) {
      return {
        profile: normaliseImportedProfile(parsed),
        warnings,
        avgLatencySamples: [],
        commandSamples: [],
      };
    }
  } catch {
    // Not JSON – fall back to log parsing.
  }

  const lines = trimmed.split(/\r?\n/);
  const avgSamples: number[] = [];
  const commandSamples: number[] = [];
  const commandRates: number[] = [];
  let detectedQueueDepth: number | undefined;
  let detectedThreads: number | undefined;
  let detectedNlb: number | undefined;
  let detectedMdts: number | undefined;

  for (const line of lines) {
    const avgMatch = line.match(AVG_LATENCY_REGEX);
    if (avgMatch) {
      const value = parseFloat(avgMatch[1]);
      if (Number.isFinite(value)) {
        avgSamples.push(value);
      }
    }

    const crcMatch = line.match(CRC_COUNT_REGEX);
    if (crcMatch) {
      const total = parseInt(crcMatch[2], 10);
      if (Number.isFinite(total) && total > 0) {
        commandSamples.push(total);
      }
    }

    const rateMatch = line.match(CRC_RATE_REGEX);
    if (rateMatch) {
      const rate = parseFloat(rateMatch[1]);
      if (Number.isFinite(rate) && rate > 0) {
        commandRates.push(rate);
      }
    }

    if (detectedQueueDepth === undefined) {
      const qdMatch = line.match(QD_REGEX);
      if (qdMatch) {
        detectedQueueDepth = parseInt(qdMatch[2], 10);
      }
    }

    if (detectedThreads === undefined) {
      const threadMatch = line.match(THREAD_REGEX);
      if (threadMatch) {
        detectedThreads = parseInt(threadMatch[2], 10);
      }
    }

    if (detectedNlb === undefined) {
      const nlbMatch = line.match(NLB_REGEX);
      if (nlbMatch) {
        detectedNlb = parseInt(nlbMatch[2], 10);
      }
    }

    if (detectedMdts === undefined) {
      const mdtsMatch = line.match(MDTS_REGEX);
      if (mdtsMatch) {
        detectedMdts = parseInt(mdtsMatch[2], 10);
      }
    }
  }

  if (!avgSamples.length) {
    throw new Error('No avg latency samples found in calibration log.');
  }

  const muPer4kUs = computeMean(avgSamples);
  let sigmaPer4kUs = computeStdDev(avgSamples);
  if (sigmaPer4kUs <= 0) {
    sigmaPer4kUs = muPer4kUs * 0.18;
    warnings.push('Unable to derive σ from log – estimated at 18% of μ.');
  }

  const sampleCount = commandSamples.length ? commandSamples.reduce((sum, value) => sum + value, 0) : 0;
  if (!sampleCount) {
    warnings.push('Unable to determine total command count – confidence will rely on simulation sample size.');
  }

  const nvmeLatencyUs = estimateNvmeLatency(muPer4kUs, commandRates);

  if (detectedQueueDepth === undefined) {
    warnings.push('Queue depth not found in log – retaining scenario value.');
  }
  if (detectedThreads === undefined) {
    warnings.push('Thread count not found in log – retaining scenario value.');
  }
  if (detectedNlb === undefined) {
    warnings.push('Read+ NLB not found – assuming 1 (4 KiB).');
  }

  const profile: CalibrationProfile = {
    id: generateCalibrationId(),
    label: options?.label ?? `Log import ${new Date().toISOString().slice(0, 10)}`,
    device: options?.device,
    firmware: options?.firmware,
    createdAt: new Date().toISOString(),
    source: 'log',
    muPer4kUs,
    sigmaPer4kUs,
    nvmeLatencyUs,
    queueDepth: detectedQueueDepth,
    threads: detectedThreads,
    readNlb: detectedNlb,
    mdtsBytes: detectedMdts,
    tolerancePercent: normaliseTolerance(options?.tolerancePercent) ?? 15,
    sampleCount,
    hostCoefficients: undefined,
    ssdCoefficients: undefined,
    notes: 'Auto-generated from exerciser log import.',
    warnings: warnings.length ? [...warnings] : undefined,
  };

  return {
    profile,
    warnings,
    avgLatencySamples: avgSamples,
    commandSamples,
  };
};

export const scenarioToCalibrationProfile = (
  scenario: EnterpriseScenario,
  options?: { label?: string; source?: CalibrationProfile['source']; id?: string },
): CalibrationProfile => {
  const label = options?.label ?? scenario.calibration?.label ?? `Scenario capture ${new Date().toISOString().slice(0, 10)}`;
  const tolerance = normaliseTolerance(scenario.calibration?.tolerancePercent) ?? 15;
  return {
    id: options?.id ?? generateCalibrationId(),
    label,
    device: scenario.calibration?.device,
    firmware: scenario.calibration?.firmware,
    createdAt: new Date().toISOString(),
    source: options?.source ?? 'manual',
    muPer4kUs: scenario.crcPer4kUs,
    sigmaPer4kUs: scenario.crcSigmaPer4kUs,
    nvmeLatencyUs: scenario.nvmeLatencyUs,
    queueDepth: scenario.queueDepth,
    threads: scenario.threads,
    readNlb: scenario.calibration?.readNlb,
    mdtsBytes: scenario.calibration?.mdtsBytes ?? scenario.mdtsBytes,
    tolerancePercent: tolerance,
    sampleCount: scenario.calibration?.sampleCount ?? 0,
    hostCoefficients: scenario.calibration?.hostCoefficients ?? { ...scenario.hostCoefficients },
    ssdCoefficients: scenario.calibration?.ssdCoefficients ?? { ...scenario.ssdCoefficients },
    notes: 'Snapshot captured from Enterprise scenario.',
    warnings: scenario.calibration?.warnings ? [...scenario.calibration.warnings] : undefined,
  };
};
