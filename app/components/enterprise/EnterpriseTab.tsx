'use client';

import React from 'react';
import {
  EnterpriseScenario,
  SimulationResult,
  AggregationTree,
  EnterpriseSolution,
  AggregatorPolicy,
  AggregationLocation,
  TimelineSegmentKind,
  ServiceDistribution,
  RetryPolicy,
  CalibrationProfile,
} from '@/lib/enterprise';
import type { TimelineSegment } from '@/lib/enterprise';
import { cn } from '@/lib/utils';
import {
  SweepConfig,
  SWEEP_KNOB_DEFINITIONS,
  computeLatencyDistribution,
  computeLaneBoxplots,
  SweepRun,
  SweepAdvisorHint,
} from '@/lib/enterprise/analytics';

export type EnterpriseMode = 'single' | 'compare' | 'sweep';

interface NumberSliderProps {
  id: string;
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  highlight?: boolean;
  helper?: string;
  formatValue?: (value: number) => string;
}

const NumberSlider: React.FC<NumberSliderProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled,
  highlight,
  helper,
  formatValue,
}) => {
  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = parseFloat(event.target.value);
    if (Number.isFinite(numeric)) {
      const clamped = Math.max(min, Math.min(max, numeric));
      onChange(clamped);
    }
  };

  const displayValue = formatValue ? formatValue(value) : value.toFixed(value % 1 === 0 ? 0 : 1);

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      aria-disabled={disabled}
    >
      <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
        <label htmlFor={id} className={cn(highlight && 'text-amber-300')}>
          {label}
        </label>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <span>{displayValue}</span>
          {unit && <span>{unit}</span>}
        </div>
      </div>
      {helper && (
        <p className={cn('text-[11px] text-zinc-500', highlight && 'text-amber-300')}>
          {helper}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(parseFloat(event.target.value))}
          disabled={disabled}
          className="flex-1 accent-sky-400"
        />
        <input
          type="number"
          value={value}
          disabled={disabled}
          onChange={handleNumberChange}
          className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-xs text-zinc-100"
          step={step}
        />
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode; disabled?: boolean; tooltip?: string }> = ({
  title,
  children,
  disabled,
  tooltip,
}) => {
  const content = (
    <fieldset disabled={disabled} className={cn('space-y-3', disabled && 'cursor-not-allowed opacity-60')}>
      <legend className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{title}</legend>
      {children}
    </fieldset>
  );

  if (!disabled || !tooltip) {
    return content;
  }

  return <div title={tooltip}>{content}</div>;
};

const segmentColor = (kind: TimelineSegmentKind): string => {
  switch (kind) {
    case 'compute':
      return 'bg-emerald-500/70 text-emerald-50';
    case 'aggregation':
      return 'bg-amber-400/80 text-zinc-900';
    case 'finalize':
      return 'bg-sky-500/70 text-zinc-900';
    case 'retry':
      return 'bg-rose-500/70 text-rose-50';
    case 'wait':
      return 'bg-zinc-600/50 text-zinc-100';
    default:
      return 'bg-blue-500/40 text-blue-50';
  }
};

// Collapse timeline segments when simulations produce tens of thousands of commands to keep DOM nodes bounded.
const summariseSegmentsForRender = (
  segments: TimelineSegment[],
  threshold = 900,
): Array<TimelineSegment & { aggregatedCount?: number }> => {
  if (segments.length <= threshold) {
    return segments.map((segment) => ({ ...segment, aggregatedCount: 1 }));
  }
  const stride = Math.ceil(segments.length / threshold);
  const condensed: Array<TimelineSegment & { aggregatedCount?: number }> = [];
  for (let index = 0; index < segments.length; index += stride) {
    const head = segments[index];
    const tail = segments[Math.min(index + stride - 1, segments.length - 1)];
    condensed.push({
      ...head,
      endUs: tail.endUs,
      aggregatedCount: Math.min(stride, segments.length - index),
    });
  }
  return condensed;
};

const formatMicros = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} ms`;
  }
  return `${value.toFixed(1)} µs`;
};

const formatObjectsPerSecond = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} K objs/s`;
  }
  return `${value.toFixed(2)} objs/s`;
};

const SOLUTION_META: Record<EnterpriseSolution, { label: string; summary: string; description: string }> = {
  s1: {
    label: 'S1 · Serial (Seeded)',
    summary: 'Serial pipeline seeded across SSDs',
    description: 'Sequential CRC chain with host validation only.',
  },
  s2: {
    label: 'S2 · Parallel + Host Aggregation',
    summary: 'Parallel CRC with host-side combine',
    description: 'Host aggregates partial CRCs after fan-out completes.',
  },
  s3: {
    label: 'S3 · Parallel + SSD Aggregation',
    summary: 'Parallel CRC with device-side combine',
    description: 'SSD performs aggregation before host validation.',
  },
};

const LATENCY_HELP_TEXT: Record<EnterpriseSolution, string> = {
  s1: 'Latency picks the conservative path between pipeline fill and steady state, including any retry delays.',
  s2: 'Latency = max SSD compute + Agg_host(x) + orchestration. Agg_host(x) = c0 + c1·x + c2·log₂(x).',
  s3: 'Latency = max SSD compute + SSD aggregator lane + orchestration. Aggregator policy drives queueing on the chosen SSD.',
};

const AGGREGATOR_POLICY_META: Record<AggregatorPolicy, string> = {
  pinned: 'Pinned SSD',
  roundRobin: 'Round-robin',
};

const AGGREGATION_LOCATION_LABEL: Record<AggregationLocation, string> = {
  serial: 'Serial pipeline',
  host: 'Host aggregation',
  ssd: 'SSD aggregation',
};

export interface EnterpriseSidebarProps {
  draftScenario: EnterpriseScenario;
  mdtsSegments: number;
  mdtsClamp: boolean;
  onUpdateScenario: (update: Partial<EnterpriseScenario>) => void;
  onUpdateHostCoefficient: (key: 'c0' | 'c1' | 'c2', value: number) => void;
  onUpdateSsdCoefficient: (key: 'd0' | 'd1', value: number) => void;
  presets: Array<{ id: string; label: string; summary: string; description?: string }>;
  activePresetId: string | null;
  onPresetSelect: (presetId: string) => void;
  onMatchPreset: () => void;
  matchPresetLabel: string;
  matchPresetDescription?: string;
  matchPresetDisabled: boolean;
  matchPresetActive: boolean;
  mode: EnterpriseMode;
  onModeChange: (mode: EnterpriseMode) => void;
  sweepConfig: SweepConfig;
  onSweepConfigChange: (update: Partial<SweepConfig>) => void;
  sweepAdvisorEnabled: boolean;
  onToggleSweepAdvisor: (value: boolean) => void;
  calibrationProfiles: CalibrationProfile[];
  onCalibrationPaste: () => void;
  onCalibrationImportClick: () => void;
  onCalibrationFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  calibrationFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onCalibrationProfileSelect: (profileId: string | null) => void;
  onCalibrationSave: () => void;
  onCalibrationClear: () => void;
  onCalibrationToggleDefaults: (value: boolean) => void;
  calibrationWarnings: string[];
  calibrationImportError: string | null;
  scenarioWarnings: string[];
  scenarioErrors: string[];
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  draftScenario,
  mdtsSegments,
  mdtsClamp,
  onUpdateScenario,
  onUpdateHostCoefficient,
  onUpdateSsdCoefficient,
  presets,
  activePresetId,
  onPresetSelect,
  onMatchPreset,
  matchPresetLabel,
  matchPresetDescription,
  matchPresetDisabled,
  matchPresetActive,
  mode,
  onModeChange,
  sweepConfig,
  onSweepConfigChange,
  sweepAdvisorEnabled,
  onToggleSweepAdvisor,
  calibrationProfiles,
  onCalibrationPaste,
  onCalibrationImportClick,
  onCalibrationFile,
  calibrationFileInputRef,
  onCalibrationProfileSelect,
  onCalibrationSave,
  onCalibrationClear,
  onCalibrationToggleDefaults,
  calibrationWarnings,
  calibrationImportError,
  scenarioWarnings,
  scenarioErrors,
}) => {
  const calibration = draftScenario.calibration;
  const activeProfileLabel = calibration?.label ?? (calibration?.profileId ? 'Imported profile' : 'None');
  const activeSampleCount = calibration?.sampleCount;
  const activeTolerance = calibration?.tolerancePercent ?? 15;
  const usingDefaults = calibration?.useProfileDefaults ?? false;
  const warnings = calibration?.warnings && calibration.warnings.length > 0
    ? calibration.warnings
    : calibrationWarnings;
  const sweepDefinition = SWEEP_KNOB_DEFINITIONS[sweepConfig.knob];
  const sweepDisabled = mode !== 'sweep';
  const clampSweepValue = (value: number, definition = sweepDefinition): number => {
    return Math.max(definition.min, Math.min(definition.max, value));
  };
  const sweepValueLabel = (value: number): string => {
    const formatter = sweepDefinition.format;
    if (formatter) {
      return formatter(value);
    }
    if (sweepDefinition.unit === 'µs') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} ms`;
      }
      return `${value.toFixed(0)} µs`;
    }
    if (sweepDefinition.unit === 'KiB') {
      if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} MiB`;
      }
      return `${value.toFixed(0)} KiB`;
    }
    return value.toFixed(0);
  };

  return (
    <div className="space-y-6 p-4">
      <Section title="Mode">
        <div className="grid grid-cols-2 gap-2">
          {(['single', 'compare', 'sweep'] as EnterpriseMode[]).map((option) => {
            const active = mode === option;
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                  active
                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                    : 'border-zinc-800 text-zinc-400 hover:border-sky-500/40 hover:text-sky-200',
                )}
                onClick={() => onModeChange(option)}
              >
                {option === 'single' && 'Single Solution'}
                {option === 'compare' && 'Compare Trio'}
                {option === 'sweep' && 'What-If Sweep'}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500">
          {mode === 'sweep'
            ? 'Sweep mode varies one knob across a range and charts S1/S2/S3 trends side-by-side.'
            : 'Compare mode runs S1/S2/S3 on the same configuration so you can inspect tail behaviour across strategies.'}
        </p>
      </Section>

      <Section
        title="What-If Sweep"
        disabled={sweepDisabled}
        tooltip="Switch to What-If Sweep mode to configure sweeps."
      >
        <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="sweep-knob" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Sweep knob
            </label>
            <span className="text-[10px] text-zinc-500">
              Range {sweepDefinition.min.toFixed(0)} – {sweepDefinition.max.toFixed(0)} {sweepDefinition.unit ?? ''}
            </span>
          </div>
          <select
            id="sweep-knob"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
            value={sweepConfig.knob}
            onChange={(event) => {
              const nextKnob = event.target.value as SweepConfig['knob'];
              const definition = SWEEP_KNOB_DEFINITIONS[nextKnob];
              onSweepConfigChange({
                knob: nextKnob,
                start: clampSweepValue(sweepConfig.start, definition),
                end: clampSweepValue(sweepConfig.end, definition),
                step: Math.max(definition.step, Math.abs(sweepConfig.step)),
              });
            }}
            disabled={sweepDisabled}
          >
            {Object.values(SWEEP_KNOB_DEFINITIONS).map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.label}
              </option>
            ))}
          </select>
          {sweepDefinition.helper && (
            <div className="text-[11px] text-zinc-500">{sweepDefinition.helper}</div>
          )}

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {(['start', 'end', 'step'] as Array<keyof SweepConfig>).map((field) => {
              const label = field === 'start' ? 'Start' : field === 'end' ? 'End' : 'Step';
              const rawValue = sweepConfig[field];
              const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
              const display = field === 'step' ? numericValue : clampSweepValue(numericValue);
              return (
                <label key={field} className="flex flex-col gap-1 text-zinc-300">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
                  <input
                    type="number"
                    value={display}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      if (!Number.isFinite(raw)) {
                        return;
                      }
                      if (field === 'step') {
                        const baseline = sweepDefinition.step || 1;
                        const safe = Math.max(baseline, Math.abs(raw));
                        onSweepConfigChange({ step: safe });
                      } else {
                        const adjusted = clampSweepValue(raw);
                        onSweepConfigChange({ [field]: adjusted } as Partial<SweepConfig>);
                      }
                    }}
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                    min={field === 'step' ? sweepDefinition.step : sweepDefinition.min}
                    max={field === 'step' ? undefined : sweepDefinition.max}
                    step={field === 'step' ? sweepDefinition.step : undefined}
                    disabled={sweepDisabled}
                  />
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-md border border-zinc-800/60 bg-zinc-950/40 px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Advisor</div>
              <div className="text-[11px] text-zinc-500">Toggle sweep advisor hints</div>
            </div>
            <button
              type="button"
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                sweepAdvisorEnabled
                  ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                  : 'border-zinc-700 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200',
              )}
              onClick={() => onToggleSweepAdvisor(!sweepAdvisorEnabled)}
              disabled={sweepDisabled}
            >
              {sweepAdvisorEnabled ? 'Advisor on' : 'Advisor off'}
            </button>
          </div>

          <div className="rounded-md border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500">
            Current window: {sweepValueLabel(clampSweepValue(sweepConfig.start))} → {sweepValueLabel(clampSweepValue(sweepConfig.end))}
          </div>
        </div>
      </Section>

      <Section title="Topology">
        <NumberSlider
          id="stripeWidth"
          label="Stripe Width (x)"
          value={draftScenario.stripeWidth}
          min={1}
          max={32}
          step={1}
          onChange={(value) => onUpdateScenario({ stripeWidth: value })}
        />
        <NumberSlider
          id="objectsInFlight"
          label="Objects in Flight"
          value={draftScenario.objectsInFlight}
          min={1}
          max={16}
          step={1}
          onChange={(value) => onUpdateScenario({ objectsInFlight: value })}
          helper="Concurrent CRC validations sharing the SSD fleet."
        />
      </Section>

      <Section title="Workload">
        <NumberSlider
          id="fileSize"
          label="File Size"
          value={draftScenario.fileSizeMB}
          min={0.5}
          max={8192}
          step={0.5}
          unit="MB"
          onChange={(value) => onUpdateScenario({ fileSizeMB: value })}
        />
        <NumberSlider
          id="chunkSize"
          label="Chunk Size"
          value={draftScenario.chunkSizeKB}
          min={4}
          max={1024}
          step={4}
          unit="KiB"
          onChange={(value) => onUpdateScenario({ chunkSizeKB: value })}
          highlight={mdtsClamp}
          helper={
            mdtsClamp
              ? `MDTS clamp active – chunks split into ${mdtsSegments} commands.`
              : 'Per-device slice size before MDTS enforcement.'
          }
        />
      </Section>

      <Section title="NVMe & Command">
        <div className="grid gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">MDTS</span>
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
              {(draftScenario.mdtsBytes / 1024).toFixed(0)} KiB
            </span>
          </div>
          <NumberSlider
            id="queueDepth"
            label="Queue Depth / SSD"
            value={draftScenario.queueDepth}
            min={1}
            max={64}
            step={1}
            onChange={(value) => onUpdateScenario({ queueDepth: value })}
            helper="Outstanding NVMe CRC commands per SSD. Higher depth increases contention."
          />
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Threads</span>
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
              {draftScenario.threads}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Service Time Model">
        <div className="grid gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Distribution</div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {(['deterministic', 'lognormal', 'gamma'] as ServiceDistribution[]).map((distribution) => {
              const active = draftScenario.serviceDistribution === distribution;
              return (
                <button
                  key={distribution}
                  type="button"
                  className={cn(
                    'rounded-lg border px-2 py-1 transition-colors',
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200',
                  )}
                  onClick={() => onUpdateScenario({ serviceDistribution: distribution })}
                >
                  {distribution === 'deterministic' && 'Deterministic'}
                  {distribution === 'lognormal' && 'Lognormal'}
                  {distribution === 'gamma' && 'Gamma'}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-500">
            μ/σ apply to a 4 KiB CRC and scale with chunk size. Deterministic mode ignores σ.
          </p>
        </div>
        <NumberSlider
          id="crcMean"
          label="μ per 4 KiB"
          value={draftScenario.crcPer4kUs}
          min={10}
          max={400}
          step={1}
          unit="µs"
          onChange={(value) => onUpdateScenario({ crcPer4kUs: value })}
          helper="Average service time for a 4 KiB CRC."
        />
        <NumberSlider
          id="crcSigma"
          label="σ per 4 KiB"
          value={draftScenario.crcSigmaPer4kUs}
          min={0}
          max={200}
          step={1}
          unit="µs"
          onChange={(value) => onUpdateScenario({ crcSigmaPer4kUs: value })}
          helper="Jitter width. Zero collapses to deterministic timing."
        />
        <NumberSlider
          id="straggler95"
          label="p95 multiplier"
          value={draftScenario.stragglerP95Multiplier}
          min={1}
          max={5}
          step={0.1}
          onChange={(value) => onUpdateScenario({ stragglerP95Multiplier: value })}
          helper="Amplify the 95th percentile to model moderate stragglers."
        />
        <NumberSlider
          id="straggler99"
          label="p99 multiplier"
          value={draftScenario.stragglerP99Multiplier}
          min={1}
          max={10}
          step={0.1}
          onChange={(value) => onUpdateScenario({ stragglerP99Multiplier: value })}
          helper="Extreme stragglers beyond the 99th percentile."
        />
      </Section>

      <Section title="Compute & Aggregation">
        <div className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Solution</div>
            <div className="mt-2 grid gap-2">
              {(['s1', 's2', 's3'] as EnterpriseSolution[]).map((solution) => {
                const meta = SOLUTION_META[solution];
                const active = draftScenario.solution === solution;
                return (
                  <button
                    key={solution}
                    type="button"
                    onClick={() => onUpdateScenario({ solution })}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                      active
                        ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                        : 'border-zinc-800 text-zinc-400 hover:border-sky-500/40 hover:text-sky-200',
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{meta.label}</span>
                      <span className="text-[10px] text-zinc-500">{meta.summary}</span>
                    </div>
                    {active && (
                      <span className="text-[10px] uppercase tracking-wide text-sky-200">Active</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Host Aggregation Model (Agg_host)
            </div>
            <NumberSlider
              id="c0"
              label="c0 (base)"
              value={draftScenario.hostCoefficients.c0}
              min={0}
              max={200}
              step={1}
              unit="µs"
              onChange={(value) => onUpdateHostCoefficient('c0', value)}
              helper="Host orchestration + memory traffic per stripe."
              highlight={draftScenario.solution === 's2'}
            />
            <NumberSlider
              id="c1"
              label="c1 (per stripe)"
              value={draftScenario.hostCoefficients.c1}
              min={0}
              max={10}
              step={0.1}
              unit="µs"
              onChange={(value) => onUpdateHostCoefficient('c1', value)}
              highlight={draftScenario.solution === 's2'}
            />
            <NumberSlider
              id="c2"
              label="c2 (log₂ term)"
              value={draftScenario.hostCoefficients.c2}
              min={0}
              max={20}
              step={0.5}
              unit="µs"
              onChange={(value) => onUpdateHostCoefficient('c2', value)}
              highlight={draftScenario.solution === 's2'}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              SSD Aggregation Model (Agg_ssd)
            </div>
            <NumberSlider
              id="d0"
              label="d0 (base)"
              value={draftScenario.ssdCoefficients.d0}
              min={0}
              max={150}
              step={0.5}
              unit="µs"
              onChange={(value) => onUpdateSsdCoefficient('d0', value)}
              highlight={draftScenario.solution === 's3'}
              helper="NVMe fan-in + command staging before SSD aggregation."
            />
            <NumberSlider
              id="d1"
              label="d1 (per stripe)"
              value={draftScenario.ssdCoefficients.d1}
              min={0}
              max={10}
              step={0.1}
              unit="µs"
              onChange={(value) => onUpdateSsdCoefficient('d1', value)}
              highlight={draftScenario.solution === 's3'}
              helper="Per-stripe combine work on SSD cores."
            />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Aggregator SSD Policy
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['pinned', 'roundRobin'] as AggregatorPolicy[]).map((policy) => {
                const active = draftScenario.aggregatorPolicy === policy;
                const disabled = draftScenario.solution !== 's3';
                return (
                  <button
                    key={policy}
                    type="button"
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs transition-colors',
                      active
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                        : 'border-zinc-800 text-zinc-400 hover:border-amber-500/40 hover:text-amber-200',
                      disabled && 'cursor-not-allowed opacity-60 hover:border-zinc-800 hover:text-zinc-400',
                    )}
                    onClick={() => onUpdateScenario({ aggregatorPolicy: policy })}
                    disabled={disabled}
                    title={disabled ? 'Aggregator policy applies when S3 is selected.' : undefined}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{AGGREGATOR_POLICY_META[policy]}</span>
                      <span className="text-[10px] text-zinc-500">
                        {policy === 'pinned' ? 'Use SSD0 for combines' : 'Rotate aggregator each stripe'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Failures & Retry">
        <NumberSlider
          id="failureProbability"
          label="Timeout probability"
          value={draftScenario.failureProbability}
          min={0}
          max={0.05}
          step={0.0005}
          onChange={(value) => onUpdateScenario({ failureProbability: value })}
          helper="Chance an NVMe CRC command times out and is retried."
          formatValue={(value) => `${(value * 100).toFixed(2)}%`}
        />
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Retry Policy</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {(['fixed', 'exponential'] as RetryPolicy[]).map((policy) => {
              const active = draftScenario.retryPolicy === policy;
              return (
                <button
                  key={policy}
                  type="button"
                  className={cn(
                    'rounded-lg border px-2 py-1 transition-colors',
                    active
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                      : 'border-zinc-800 text-zinc-400 hover:border-amber-500/40 hover:text-amber-200',
                  )}
                  onClick={() => onUpdateScenario({ retryPolicy: policy })}
                >
                  {policy === 'fixed' ? 'Fixed Backoff' : 'Exponential'}
                </button>
              );
            })}
          </div>
        </div>
        <NumberSlider
          id="retryBackoff"
          label="Retry backoff"
          value={draftScenario.retryBackoffUs}
          min={0}
          max={2000}
          step={10}
          unit="µs"
          onChange={(value) => onUpdateScenario({ retryBackoffUs: value })}
        />
        <NumberSlider
          id="retryMax"
          label="Max attempts"
          value={draftScenario.retryMaxAttempts}
          min={1}
          max={8}
          step={1}
          onChange={(value) => onUpdateScenario({ retryMaxAttempts: value })}
          helper="Simulation forces success on the last attempt to model host fallback."
        />
      </Section>

      <Section title="Simulation Control">
        <NumberSlider
          id="randomSeed"
          label="Random seed"
          value={draftScenario.randomSeed}
          min={1}
          max={1_000_000}
          step={1}
          onChange={(value) => onUpdateScenario({ randomSeed: value })}
          helper="Use the same seed to reproduce stochastic runs."
        />
      </Section>

      <Section title="Guardrails">
        {scenarioErrors.length === 0 && scenarioWarnings.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
            No blocking issues detected for this scenario.
          </div>
        ) : (
          <div className="space-y-2">
            {scenarioErrors.length > 0 && (
              <div className="space-y-1 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200" role="alert">
                {scenarioErrors.map((message) => (
                  <div key={`error-${message}`}>{message}</div>
                ))}
              </div>
            )}
            {scenarioWarnings.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                {scenarioWarnings.map((message) => (
                  <div key={`warn-${message}`}>{message}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Calibration">
        <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Active profile</span>
            <span className="font-semibold text-zinc-100">{activeProfileLabel}</span>
          </div>
          <div className="grid gap-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span>Sample count</span>
              <span className="font-semibold text-zinc-100">{typeof activeSampleCount === 'number' ? activeSampleCount : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tolerance window</span>
              <span className="font-semibold text-zinc-100">{activeTolerance}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Defaults</span>
              <button
                type="button"
                onClick={() => onCalibrationToggleDefaults(!usingDefaults)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
                  usingDefaults
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                    : 'border-zinc-700 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200',
                )}
              >
                {usingDefaults ? 'Using profile defaults' : 'Manual overrides'}
              </button>
            </div>
          </div>

          <div className="grid gap-2 pt-3 text-[11px]">
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
              value={calibration?.profileId ?? ''}
              onChange={(event) => onCalibrationProfileSelect(event.target.value ? event.target.value : null)}
            >
              <option value="">Select saved profile…</option>
              {calibrationProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCalibrationImportClick}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-sky-500/40 hover:text-sky-200"
              >
                Import log file
              </button>
              <button
                type="button"
                onClick={onCalibrationPaste}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-sky-500/40 hover:text-sky-200"
              >
                Paste log
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCalibrationSave}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-200"
              >
                Save profile
              </button>
              <button
                type="button"
                onClick={onCalibrationClear}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-rose-500/40 hover:text-rose-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        <input
          ref={calibrationFileInputRef}
          type="file"
          accept=".txt,.log,.json,.jsonc"
          hidden
          onChange={onCalibrationFile}
        />
        {calibrationImportError && (
          <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
            {calibrationImportError}
          </div>
        )}
        {warnings && warnings.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Presets">
        <div className="space-y-2">
          {presets.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetSelect(preset.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                  active
                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                    : 'border-zinc-800 text-zinc-400 hover:border-sky-500/40 hover:text-sky-200',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-100">{preset.label}</span>
                  {active && (
                    <span className="text-[10px] uppercase tracking-wide text-sky-200">Active</span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500">{preset.summary}</div>
                {preset.description && (
                  <div className="text-[10px] text-zinc-600">{preset.description}</div>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onMatchPreset}
            disabled={matchPresetDisabled}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors',
              matchPresetActive
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200',
              matchPresetDisabled && 'cursor-not-allowed opacity-60 hover:border-zinc-800 hover:text-zinc-400',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-100">{matchPresetLabel}</span>
              {matchPresetActive && (
                <span className="text-[10px] uppercase tracking-wide text-emerald-200">Active</span>
              )}
            </div>
            {matchPresetDescription && (
              <div className="text-[10px] text-zinc-500">{matchPresetDescription}</div>
            )}
          </button>
        </div>
      </Section>
    </div>
  );
};

export interface EnterpriseResultsProps {
  mode: EnterpriseMode;
  result: SimulationResult;
  compareResults?: SimulationResult[];
  draftScenario: EnterpriseScenario;
  isRunning: boolean;
  progress: number;
  showCritical: boolean;
  onToggleCritical: () => void;
  eventsOpen: boolean;
  onToggleEvents: () => void;
  onRun: () => void;
  onRunSweep?: () => void;
  onExportScenario: () => void;
  onExportResults: () => void;
  onExportSnapshot: () => void;
  onExportSweep?: () => void;
  onImportClick: () => void;
  importError: string | null;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  sweepRun?: SweepRun | null;
  sweepAdvisorHints?: SweepAdvisorHint[];
  sweepAdvisorEnabled?: boolean;
  validationWarnings: string[];
  validationErrors: string[];
}

const renderAggregationTree = (tree: AggregationTree): React.ReactNode => {
  if (!tree.stages.length) {
    return (
      <div className="rounded border border-zinc-900 bg-zinc-950/30 p-3 text-xs text-zinc-500">
        Aggregation stages will appear once a supported solution is selected.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tree.stages.map((stage) => (
        <div
          key={stage.id}
          className="min-w-[160px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{stage.label}</div>
          <div className="mt-2 text-lg font-semibold text-zinc-100">
            {stage.durationUs > 0 ? formatMicros(stage.durationUs) : '—'}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Fan-in {stage.fanIn} · Nodes {stage.nodes}
          </div>
        </div>
      ))}
    </div>
  );
};

interface EnterpriseCompareResultsProps {
  results: SimulationResult[];
  draftScenario: EnterpriseScenario;
  onRun: () => void;
  onExportScenario: () => void;
  onExportResults: () => void;
  onExportSnapshot: () => void;
  onImportClick: () => void;
  importError: string | null;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isRunning: boolean;
  progress: number;
  validationWarnings: string[];
  validationErrors: string[];
}

const EnterpriseCompareResults: React.FC<EnterpriseCompareResultsProps> = ({
  results,
  draftScenario,
  onRun,
  onExportScenario,
  onExportResults,
  onExportSnapshot,
  onImportClick,
  importError,
  fileInputRef,
  onImportFile,
  isRunning,
  progress,
  validationWarnings,
  validationErrors,
}) => {
  const sorted = [...results].sort((a, b) => a.kpis.p99Us - b.kpis.p99Us);
  const bestP99 = sorted.length > 0 ? sorted[0].kpis.p99Us : 0;
  const bestLatency = sorted.length > 0 ? Math.min(...sorted.map((item) => item.kpis.latencyUs)) : 0;
  const bestThroughput = sorted.length > 0 ? Math.max(...sorted.map((item) => item.kpis.throughputObjsPerSec)) : 0;

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-zinc-300">
            Compare Trio
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-200">All solutions · Phase 4 calibrated stochastic</div>
            <div className="text-[11px] text-zinc-500">
              Stripe {draftScenario.stripeWidth} · Objects {draftScenario.objectsInFlight} · Seed {draftScenario.randomSeed}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportScenario}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Scenario JSON
          </button>
          <button
            onClick={onExportResults}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Results CSV
          </button>
          <button
            onClick={onExportSnapshot}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Snapshot JSON
          </button>
          <button
            onClick={onImportClick}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Import Scenario
          </button>
          <input ref={fileInputRef} type="file" accept=".json" hidden onChange={onImportFile} />
          <button
            onClick={onRun}
            className="rounded-full border border-sky-500/60 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRunning || validationErrors.length > 0}
            title={validationErrors.length > 0 ? validationErrors[0] : undefined}
          >
            Run Comparison
          </button>
          {(isRunning || progress > 0) && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400" aria-live="polite">
              <span>{isRunning ? `Running ${Math.min(100, Math.round(progress))}%` : `Done ${Math.min(100, Math.round(progress))}%`}</span>
              <div className="h-1.5 w-20 overflow-hidden rounded bg-zinc-800">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {importError && (
        <div className="border-b border-rose-500/60 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {importError}
        </div>
      )}

      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="space-y-2 border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-[11px]">
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-rose-200" role="alert">
              {validationErrors.map((message) => (
                <div key={`compare-error-${message}`}>{message}</div>
              ))}
            </div>
          )}
          {validationWarnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">
              {validationWarnings.map((message) => (
                <div key={`compare-warning-${message}`}>{message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="grid gap-4 p-6 lg:grid-cols-3">
          {sorted.map((item) => {
            const meta = SOLUTION_META[item.scenario.solution];
            const aggregationLabel = AGGREGATION_LOCATION_LABEL[item.derived.aggregatorLocation];
            const deltaP99 = item.kpis.p99Us - bestP99;
            const deltaLatency = item.kpis.latencyUs - bestLatency;
            const deltaThroughput = bestThroughput > 0
              ? ((item.kpis.throughputObjsPerSec - bestThroughput) / bestThroughput) * 100
              : 0;
            const ratio = bestP99 > 0 ? item.kpis.p99Us / bestP99 : 1;
            const confidenceSet = item.kpis.confidence;
            const confidenceLabel = confidenceSet ? `${Math.round(confidenceSet.confidenceLevel * 100)}% CI` : null;
            const p99Margin = confidenceSet?.p99?.margin;
            const latencyMargin = confidenceSet?.latency?.margin;
            const throughputMargin = confidenceSet?.throughput?.margin;

            return (
              <div
                key={item.scenario.solution}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">{meta.label}</div>
                    <div className="text-[11px] text-zinc-500">{meta.summary}</div>
                  </div>
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    {aggregationLabel}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">p99 latency</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-zinc-100">{formatMicros(item.kpis.p99Us)}</span>
                    <span className={cn('text-[11px]', deltaP99 <= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                      {deltaP99 <= 0 ? 'best' : `+${formatMicros(deltaP99)}`}
                    </span>
                  </div>
                  {p99Margin && p99Margin > 0 && confidenceLabel && (
                    <div className="text-[10px] text-zinc-500">± {formatMicros(p99Margin)} ({confidenceLabel})</div>
                  )}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
                    <div
                      className={cn(
                        'h-full rounded',
                        ratio <= 1.05 ? 'bg-emerald-400/80' : ratio <= 1.2 ? 'bg-amber-400/80' : 'bg-rose-400/80',
                      )}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Latency (total)</div>
                    <div className="text-sm font-semibold text-zinc-100">{formatMicros(item.kpis.latencyUs)}</div>
                    {deltaLatency > 0 && (
                      <div className="text-[10px] text-rose-300">+{formatMicros(deltaLatency)}</div>
                    )}
                    {latencyMargin && latencyMargin > 0 && confidenceLabel && (
                      <div className="text-[10px] text-zinc-500">± {formatMicros(latencyMargin)} ({confidenceLabel})</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Throughput</div>
                    <div className="text-sm font-semibold text-zinc-100">{formatObjectsPerSecond(item.kpis.throughputObjsPerSec)}</div>
                    {deltaThroughput !== 0 && (
                      <div className={cn('text-[10px]', deltaThroughput >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                        {deltaThroughput >= 0 ? '+' : ''}{deltaThroughput.toFixed(1)}%
                      </div>
                    )}
                    {throughputMargin && throughputMargin > 0 && confidenceLabel && (
                      <div className="text-[10px] text-zinc-500">
                        ± {formatObjectsPerSecond(throughputMargin)} ({confidenceLabel})
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Failures</div>
                    <div className="text-sm font-semibold text-zinc-100">{item.derived.failures}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Retries</div>
                    <div className="text-sm font-semibold text-zinc-100">{item.derived.retries}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Queue depth</div>
                    <div className="text-sm font-semibold text-zinc-100">{item.scenario.queueDepth}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Runbook entries</div>
                    <div className="text-sm font-semibold text-zinc-100">{item.runbook.length}</div>
                  </div>
                  {confidenceSet && (
                    <div className="col-span-2 rounded-md border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-[10px] text-zinc-400">
                      <div className="font-semibold text-zinc-200">Confidence</div>
                      <div>{Math.round(confidenceSet.confidenceLevel * 100)}% CI · n={confidenceSet.objectCount}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface EnterpriseSweepResultsProps {
  sweepRun?: SweepRun | null;
  isRunning: boolean;
  progress: number;
  onRun: () => void;
  onExportScenario: () => void;
  onExportSnapshot: () => void;
  onExportSweep?: () => void;
  onImportClick: () => void;
  importError: string | null;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  advisorEnabled: boolean;
  advisorHints: SweepAdvisorHint[];
  validationWarnings: string[];
  validationErrors: string[];
}

const SWEEP_SOLUTION_COLORS: Record<EnterpriseSolution, string> = {
  s1: '#a855f7',
  s2: '#38bdf8',
  s3: '#facc15',
};

const EMPTY_SWEEP_POINTS: Array<{ value: number; results: Record<EnterpriseSolution, SimulationResult> }> = [];
const DEFAULT_SWEEP_SOLUTIONS: EnterpriseSolution[] = ['s1', 's2', 's3'];

const EnterpriseSweepResults: React.FC<EnterpriseSweepResultsProps> = ({
  sweepRun,
  isRunning,
  progress,
  onRun,
  onExportScenario,
  onExportSnapshot,
  onExportSweep,
  onImportClick,
  importError,
  fileInputRef,
  onImportFile,
  advisorEnabled,
  advisorHints,
  validationWarnings,
  validationErrors,
}) => {
  const points = sweepRun?.points ?? EMPTY_SWEEP_POINTS;
  const knobId = sweepRun?.config.knob ?? 'stripeWidth';
  const knobDefinition = SWEEP_KNOB_DEFINITIONS[knobId];
  const solutions = sweepRun?.solutions ?? DEFAULT_SWEEP_SOLUTIONS;
  const hasData = points.length > 0;
  const describeValue = React.useCallback((value: number): string => {
    if (knobDefinition.unit === 'µs') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} ms`;
      }
      return `${value.toFixed(0)} µs`;
    }
    if (knobDefinition.unit === 'KiB') {
      if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} MiB`;
      }
      return `${value.toFixed(0)} KiB`;
    }
    if (knobDefinition.unit === '×') {
      return `${value.toFixed(0)}×`;
    }
    return value.toFixed(0);
  }, [knobDefinition]);

  const chartWidth = 620;
  const chartHeight = 200;
  const paddingX = 26;
  const paddingY = 22;
  const p99Series = React.useMemo(() => {
    const series: Record<EnterpriseSolution, { points: string; values: number[] }> = {} as Record<EnterpriseSolution, { points: string; values: number[] }>;
    const allValues: number[] = [];
    solutions.forEach((solution) => {
      const valuesForSolution = points.map((point) => point.results[solution]?.kpis.p99Us ?? 0);
      allValues.push(...valuesForSolution);
      series[solution] = { points: '', values: valuesForSolution };
    });
    const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
    const span = Math.max(maxValue - minValue, 1);
    const xStride = points.length > 1 ? (chartWidth - paddingX * 2) / (points.length - 1) : 0;
    solutions.forEach((solution) => {
      const entries = series[solution];
      const coords: string[] = [];
      entries.values.forEach((value, index) => {
        const x = paddingX + xStride * index;
        const ratio = entries.values.length > 1 ? (value - minValue) / span : 0.5;
        const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
        coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      });
      entries.points = coords.join(' ');
    });
    return series;
  }, [points, solutions]);

  const throughputSeries = React.useMemo(() => {
    const series: Record<EnterpriseSolution, { points: string; values: number[] }> = {} as Record<EnterpriseSolution, { points: string; values: number[] }>;
    const allValues: number[] = [];
    solutions.forEach((solution) => {
      const valuesForSolution = points.map((point) => point.results[solution]?.kpis.throughputObjsPerSec ?? 0);
      allValues.push(...valuesForSolution);
      series[solution] = { points: '', values: valuesForSolution };
    });
    const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
    const span = Math.max(maxValue - minValue, 1);
    const xStride = points.length > 1 ? (chartWidth - paddingX * 2) / (points.length - 1) : 0;
    solutions.forEach((solution) => {
      const entries = series[solution];
      const coords: string[] = [];
      entries.values.forEach((value, index) => {
        const x = paddingX + xStride * index;
        const ratio = entries.values.length > 1 ? (value - minValue) / span : 0.5;
        const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
        coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      });
      entries.points = coords.join(' ');
    });
    return series;
  }, [points, solutions]);

  const summaryRows = React.useMemo(() => {
    if (!hasData) {
      return [] as Array<{ value: number; label: string; best: EnterpriseSolution; improvement: number; p99: number; throughput: number }>;
    }
    return points.map((point) => {
      const entries = solutions
        .map((solution) => {
          const result = point.results[solution];
          return {
            solution,
            p99: result.kpis.p99Us,
            throughput: result.kpis.throughputObjsPerSec,
          };
        })
        .sort((a, b) => a.p99 - b.p99);
      const best = entries[0];
      const runner = entries[1] ?? best;
      const improvement = runner.p99 > 0 ? ((runner.p99 - best.p99) / runner.p99) * 100 : 0;
      return {
        value: point.value,
        label: describeValue(point.value),
        best: best.solution,
        improvement,
        p99: best.p99,
        throughput: best.throughput,
      };
    });
  }, [describeValue, hasData, points, solutions]);

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-zinc-300">
            What-If Sweep
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-200">{knobDefinition.label} sweep · {solutions.length} solutions</div>
            {sweepRun && (
              <div className="text-[11px] text-zinc-500">
                {describeValue(sweepRun.config.start)} → {describeValue(sweepRun.config.end)} · step ≥ {sweepRun.config.step.toFixed(2)} · {points.length} points
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportScenario}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Scenario JSON
          </button>
          <button
            onClick={onExportSnapshot}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Snapshot JSON
          </button>
          {onExportSweep && (
            <button
              onClick={onExportSweep}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              Export Sweep CSV
            </button>
          )}
          <button
            onClick={onImportClick}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Import Scenario
          </button>
          <button
            onClick={onRun}
            className="rounded-full border border-sky-500/60 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRunning || validationErrors.length > 0}
            title={validationErrors.length > 0 ? validationErrors[0] : undefined}
          >
            Run Sweep
          </button>
          {(isRunning || progress > 0) && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400" aria-live="polite">
              <span>{isRunning ? `Running ${Math.min(100, Math.round(progress))}%` : `Done ${Math.min(100, Math.round(progress))}%`}</span>
              <div className="h-1.5 w-20 overflow-hidden rounded bg-zinc-800">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {importError && (
        <div className="border-b border-rose-500/60 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {importError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />

      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="space-y-2 border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-[11px]">
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-rose-200" role="alert">
              {validationErrors.map((message) => (
                <div key={`sweep-error-${message}`}>{message}</div>
              ))}
            </div>
          )}
          {validationWarnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">
              {validationWarnings.map((message) => (
                <div key={`sweep-warning-${message}`}>{message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-6">
          {advisorEnabled && advisorHints.length > 0 && (
            <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
              {advisorHints.map((hint) => (
                <div
                  key={hint.id}
                  className={cn(
                    'flex items-start gap-2',
                    hint.tone === 'warning' && 'text-amber-200',
                    hint.tone === 'neutral' && 'text-zinc-200',
                  )}
                >
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-current" />
                  <span>{hint.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
              <div className="text-sm font-semibold">p99 trend</div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                {solutions.map((solution) => (
                  <span key={solution} className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: SWEEP_SOLUTION_COLORS[solution] }}
                    />
                    {SOLUTION_META[solution].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-4">
              {hasData ? (
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-52 w-full">
                  <rect x={paddingX} y={paddingY} width={chartWidth - paddingX * 2} height={chartHeight - paddingY * 2} className="fill-transparent stroke-zinc-800" />
                  {solutions.map((solution) => (
                    <polyline
                      key={`p99-${solution}`}
                      fill="none"
                      strokeWidth={2}
                      stroke={SWEEP_SOLUTION_COLORS[solution]}
                      points={p99Series[solution]?.points ?? ''}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              ) : (
                <div className="px-6 py-8 text-center text-sm text-zinc-500">
                  Run the sweep to chart p99 across the selected range.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="border-b border-zinc-800/60 px-6 py-3 text-sm font-semibold">Throughput trend</div>
            <div className="px-4 py-4">
              {hasData ? (
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-52 w-full">
                  <rect x={paddingX} y={paddingY} width={chartWidth - paddingX * 2} height={chartHeight - paddingY * 2} className="fill-transparent stroke-zinc-800" />
                  {solutions.map((solution) => (
                    <polyline
                      key={`throughput-${solution}`}
                      fill="none"
                      strokeWidth={2}
                      stroke={SWEEP_SOLUTION_COLORS[solution]}
                      points={throughputSeries[solution]?.points ?? ''}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={solution === 's1' ? '4 3' : solution === 's2' ? '0' : '6 4'}
                    />
                  ))}
                </svg>
              ) : (
                <div className="px-6 py-8 text-center text-sm text-zinc-500">
                  Throughput projections will appear once the sweep completes.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="border-b border-zinc-800/60 px-6 py-3 text-sm font-semibold">Best solution per sweep point</div>
            <div className="overflow-x-auto px-6 py-4">
              {summaryRows.length > 0 ? (
                <table className="min-w-full text-left text-xs text-zinc-300">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
                      <th className="pb-2 pr-4">Value</th>
                      <th className="pb-2 pr-4">Winner</th>
                      <th className="pb-2 pr-4">p99</th>
                      <th className="pb-2 pr-4">Throughput</th>
                      <th className="pb-2">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={row.value} className="border-t border-zinc-800/60">
                        <td className="py-2 pr-4 font-medium text-zinc-200">{row.label}</td>
                        <td className="py-2 pr-4">
                          <span className="font-semibold" style={{ color: SWEEP_SOLUTION_COLORS[row.best] }}>
                            {SOLUTION_META[row.best].label}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{formatMicros(row.p99)}</td>
                        <td className="py-2 pr-4">{formatObjectsPerSecond(row.throughput)}</td>
                        <td className="py-2">
                          {row.improvement > 0 ? `+${row.improvement.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-zinc-500">Run the sweep to populate the table.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EnterpriseResults: React.FC<EnterpriseResultsProps> = ({
  mode,
  result,
  compareResults,
  draftScenario,
  isRunning,
  progress,
  showCritical,
  onToggleCritical,
  eventsOpen,
  onToggleEvents,
  onRun,
  onRunSweep,
  onExportScenario,
  onExportResults,
  onExportSnapshot,
  onExportSweep,
  onImportClick,
  importError,
  fileInputRef,
  onImportFile,
  sweepRun,
  sweepAdvisorHints,
  sweepAdvisorEnabled,
  validationWarnings,
  validationErrors,
}) => {
  const latencyDistribution = React.useMemo(
    () => computeLatencyDistribution(result.derived.objectLatenciesUs, 24),
    [result.derived.objectLatenciesUs],
  );
  const laneBoxplots = React.useMemo(() => computeLaneBoxplots(result.lanes), [result.lanes]);
  const pdfChart = React.useMemo(() => {
    const chartWidth = 360;
    const chartHeight = 160;
    const padX = 24;
    const padY = 18;
    const bins = latencyDistribution.bins;
    if (bins.length === 0) {
      return {
        pdfPoints: '',
        cdfPoints: '',
        ticks: [] as Array<{ x: number; label: string }>,
        width: chartWidth,
        height: chartHeight,
        padX,
        padY,
      };
    }
    const peak = Math.max(latencyDistribution.peakDensity, 1e-6);
    const stride = bins.length > 1 ? (chartWidth - padX * 2) / (bins.length - 1) : 0;
    const pdfCoords: string[] = [];
    const cdfCoords: string[] = [];
    const ticks: Array<{ x: number; label: string }> = [];
    bins.forEach((bin, index) => {
      const x = padX + stride * index;
      const pdfRatio = bin.density / peak;
      const pdfY = chartHeight - padY - pdfRatio * (chartHeight - padY * 2);
      pdfCoords.push(`${x.toFixed(1)},${pdfY.toFixed(1)}`);
      const cdfY = chartHeight - padY - bin.cumulative * (chartHeight - padY * 2);
      cdfCoords.push(`${x.toFixed(1)},${cdfY.toFixed(1)}`);
      if (index === 0 || index === bins.length - 1 || index === Math.floor(bins.length / 2)) {
        ticks.push({ x, label: formatMicros(bin.start) });
      }
    });
    return {
      pdfPoints: pdfCoords.join(' '),
      cdfPoints: cdfCoords.join(' '),
      ticks,
      width: chartWidth,
      height: chartHeight,
      padX,
      padY,
    };
  }, [latencyDistribution]);
  const laneBoxMax = React.useMemo(() => {
    if (laneBoxplots.length === 0) {
      return 0;
    }
    return Math.max(...laneBoxplots.map((entry) => entry.max));
  }, [laneBoxplots]);

  if (mode === 'compare') {
    return (
      <EnterpriseCompareResults
        results={compareResults ?? []}
        draftScenario={draftScenario}
        onRun={onRun}
        onExportScenario={onExportScenario}
        onExportResults={onExportResults}
        onExportSnapshot={onExportSnapshot}
        onImportClick={onImportClick}
        importError={importError}
        fileInputRef={fileInputRef}
        onImportFile={onImportFile}
        isRunning={isRunning}
        progress={progress}
        validationWarnings={validationWarnings}
        validationErrors={validationErrors}
      />
    );
  }

  if (mode === 'sweep') {
    return (
      <EnterpriseSweepResults
        sweepRun={sweepRun}
        isRunning={isRunning}
        progress={progress}
        onRun={onRunSweep ?? onRun}
        onExportScenario={onExportScenario}
        onExportSnapshot={onExportSnapshot}
        onExportSweep={onExportSweep}
        onImportClick={onImportClick}
        importError={importError}
        fileInputRef={fileInputRef}
        onImportFile={onImportFile}
        advisorEnabled={sweepAdvisorEnabled ?? false}
        advisorHints={sweepAdvisorHints ?? []}
        validationWarnings={validationWarnings}
        validationErrors={validationErrors}
      />
    );
  }

  const total = result.derived.totalLatencyUs || 1;
  const solution = result.scenario.solution;
  const solutionMeta = SOLUTION_META[solution];
  const aggregationLabel = AGGREGATION_LOCATION_LABEL[result.derived.aggregatorLocation];
  const aggregatorPolicyLabel =
    solution === 's3' ? AGGREGATOR_POLICY_META[result.scenario.aggregatorPolicy] : null;
  const hasPipelineEstimates =
    typeof result.derived.pipelineFillUs === 'number' && typeof result.derived.steadyStateUs === 'number';
  const distributionDescriptor =
    draftScenario.serviceDistribution === 'deterministic'
      ? 'Deterministic μ only'
      : `${draftScenario.serviceDistribution === 'lognormal' ? 'Lognormal' : 'Gamma'} μ=${draftScenario.crcPer4kUs.toFixed(0)} µs σ=${draftScenario.crcSigmaPer4kUs.toFixed(0)} µs`;
  const confidence = result.kpis.confidence;
  const calibrationSummary = result.derived.calibration;
  const metrics = [
    { label: 'Latency p50', value: result.kpis.p50Us, formatter: formatMicros, margin: confidence?.p50?.margin },
    { label: 'Latency p95', value: result.kpis.p95Us, formatter: formatMicros, margin: confidence?.p95?.margin },
    { label: 'Latency p99', value: result.kpis.p99Us, formatter: formatMicros, margin: confidence?.p99?.margin },
    { label: 'Throughput', value: result.kpis.throughputObjsPerSec, formatter: formatObjectsPerSecond, margin: confidence?.throughput?.margin },
  ];

  const summaryChips = [
    { label: 'Failures', value: String(result.derived.failures) },
    { label: 'Retries', value: String(result.derived.retries) },
    { label: 'Objects', value: String(result.derived.objectLatenciesUs.length) },
    { label: 'Seed', value: `#${draftScenario.randomSeed}` },
  ];

  if (confidence) {
    summaryChips.push({
      label: 'Confidence',
      value: `${Math.round(confidence.confidenceLevel * 100)}% · n=${confidence.objectCount}`,
    });
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-zinc-300">
            Single Solution
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-200">{solutionMeta.label}</div>
            <div className="text-[11px] text-zinc-500">
              Phase 4 · {distributionDescriptor} · {aggregationLabel}
              {aggregatorPolicyLabel ? ` · ${aggregatorPolicyLabel}` : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportScenario}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Scenario JSON
          </button>
          <button
            onClick={onExportResults}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Results CSV
          </button>
          <button
            onClick={onExportSnapshot}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export Snapshot JSON
          </button>
          <button
            onClick={onImportClick}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Import Scenario
          </button>
          <button
            onClick={onToggleCritical}
            className={cn(
              'rounded-full border border-zinc-700 px-3 py-1 text-xs transition-colors',
              showCritical ? 'bg-amber-500/30 text-amber-200' : 'hover:bg-zinc-800',
            )}
          >
            {showCritical ? 'Critical Path ✓' : 'Highlight Critical Path'}
          </button>
          <button
            onClick={onRun}
            className="rounded-full border border-sky-500/60 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRunning || validationErrors.length > 0}
            title={validationErrors.length > 0 ? validationErrors[0] : undefined}
          >
            Run Simulation
          </button>
          {(isRunning || progress > 0) && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span>{isRunning ? `Running ${Math.min(100, Math.round(progress))}%` : `Done ${Math.min(100, Math.round(progress))}%`}</span>
              <div className="h-1.5 w-20 overflow-hidden rounded bg-zinc-800">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {importError && (
        <div className="border-b border-rose-500/60 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {importError}
        </div>
      )}

      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="space-y-2 border-b border-zinc-800/60 bg-zinc-900/40 px-6 py-3 text-[11px]">
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-rose-200" role="alert">
              {validationErrors.map((message) => (
                <div key={`single-error-${message}`}>{message}</div>
              ))}
            </div>
          )}
          {validationWarnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">
              {validationWarnings.map((message) => (
                <div key={`single-warning-${message}`}>{message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />

      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const displayValue = metric.formatter(metric.value);
              const marginValue = metric.margin && metric.margin > 0 ? metric.formatter(metric.margin) : null;
              return (
                <div key={metric.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 shadow-sm">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{metric.label}</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-100">{displayValue}</div>
                  {marginValue && (
                    <div className="text-[11px] text-zinc-500">
                      ± {marginValue}
                      {confidence && (
                        <span className="ml-1 text-zinc-600">
                          ({Math.round(confidence.confidenceLevel * 100)}% CI)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {summaryChips.map((chip) => (
              <span
                key={chip.label}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-300"
              >
                {chip.label}: {chip.value}
              </span>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-400">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">How latency is computed</div>
            <p className="mt-1">
              {LATENCY_HELP_TEXT[solution]}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
              <div className="text-sm font-semibold">Timeline</div>
              <div className="text-[11px] text-zinc-500">Horizon {formatMicros(total)}</div>
            </div>
            {(isRunning || progress > 0) && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-950/70 backdrop-blur-sm" aria-live="polite">
                <div className="text-sm font-semibold text-sky-200">
                  {isRunning ? 'Running enterprise simulation…' : 'Simulation complete'}
                </div>
                <div className="h-1.5 w-40 overflow-hidden rounded bg-zinc-800">
                  <div
                    className="h-full bg-sky-500 transition-all"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <div className="text-xs text-zinc-400">{Math.min(100, Math.round(progress))}%</div>
              </div>
            )}
            <div className="overflow-x-auto">
              <div className="space-y-3 px-6 py-4">
                {result.lanes.map((lane) => {
                  const emphasise = showCritical ? lane.isCritical : true;
                  const laneTotal = lane.totalUs || total;
                  const segmentsToRender = summariseSegmentsForRender(lane.segments);
                  return (
                    <div key={lane.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="font-semibold text-zinc-200">{lane.label}</span>
                        <span>{formatMicros(laneTotal)}</span>
                      </div>
                      <div className="relative h-8 rounded-lg border border-zinc-800 bg-zinc-950/60">
                        {segmentsToRender.map((segment, index) => {
                          const width = ((segment.endUs - segment.startUs) / laneTotal) * 100;
                          const left = (segment.startUs / laneTotal) * 100;
                          const durationUs = segment.endUs - segment.startUs;
                          const aggregationHint = segment.aggregatedCount && segment.aggregatedCount > 1
                            ? ` · ${segment.aggregatedCount} segments aggregated`
                            : '';
                          return (
                            <div
                              key={`${lane.id}-${segment.startUs}-${segment.endUs}-${segment.kind}-${index}`}
                              className={cn(
                                'absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded px-2 text-[10px] transition-opacity',
                                segmentColor(segment.kind as TimelineSegmentKind),
                                emphasise ? 'opacity-100' : 'opacity-20',
                              )}
                              style={{
                                width: `${Math.max(width, 0.6)}%`,
                                left: `${left}%`,
                              }}
                              title={`${segment.label} (${formatMicros(durationUs)})${aggregationHint}`}
                            >
                              <span className="truncate">{segment.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="border-b border-zinc-800/60 px-6 py-3 text-sm font-semibold">Queue Heatmap</div>
            <div className="space-y-3 px-6 py-4">
              {result.heatmap.map((lane) => {
                const laneSamples = lane.samples;
                const laneTotal = laneSamples.length > 0 ? laneSamples[laneSamples.length - 1].timeUs : total;
                return (
                  <div key={lane.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="font-semibold text-zinc-200">{lane.label}</span>
                      <span>Peak occupancy {lane.peak}</span>
                    </div>
                    <div className="h-5 overflow-hidden rounded bg-zinc-950/60">
                      <div className="flex h-full">
                        {laneSamples.slice(0, -1).map((sample, index) => {
                          const next = laneSamples[index + 1];
                          const duration = Math.max(0, next.timeUs - sample.timeUs);
                          const widthPercent = laneTotal > 0 ? (duration / laneTotal) * 100 : 0;
                          const occupancy = sample.occupancy;
                          const intensity = lane.peak > 0 ? occupancy / lane.peak : 0;
                          const baseColor = lane.role === 'host' ? [56, 189, 248] : lane.role === 'aggregator' ? [251, 191, 36] : [34, 197, 94];
                          const background = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${0.15 + intensity * 0.7})`;
                          return (
                            <div
                              key={`${lane.id}-heat-${index}`}
                              style={{ width: `${widthPercent}%`, background }}
                              title={`t=${formatMicros(sample.timeUs)} occupancy=${occupancy}`}
                              className="h-full"
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
              <div className="text-sm font-semibold">Latency Distributions</div>
              <div className="text-[11px] text-zinc-500">
                Samples {latencyDistribution.total} · μ {formatMicros(latencyDistribution.mean)} · σ {formatMicros(latencyDistribution.stdDev)}
              </div>
            </div>
            <div className="grid gap-6 px-6 py-4 lg:grid-cols-2">
              <div>
                {latencyDistribution.bins.length > 0 ? (
                  <svg viewBox={`0 0 ${pdfChart.width} ${pdfChart.height}`} className="h-44 w-full">
                    <rect
                      x={pdfChart.padX}
                      y={pdfChart.padY}
                      width={pdfChart.width - pdfChart.padX * 2}
                      height={pdfChart.height - pdfChart.padY * 2}
                      className="fill-transparent stroke-zinc-800"
                    />
                    <polyline
                      points={pdfChart.pdfPoints}
                      fill="none"
                      strokeWidth={2}
                      stroke="#34d399"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={pdfChart.cdfPoints}
                      fill="none"
                      strokeWidth={2}
                      stroke="#38bdf8"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {pdfChart.ticks.map((tick) => (
                      <text
                        key={`tick-${tick.x}`}
                        x={tick.x}
                        y={pdfChart.height - 4}
                        textAnchor="middle"
                        className="fill-zinc-500 text-[10px]"
                      >
                        {tick.label}
                      </text>
                    ))}
                  </svg>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-zinc-500">
                    Latency samples will appear after running the simulation.
                  </div>
                )}
                <div className="mt-2 flex items-center justify-start gap-4 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#34d399]" /> PDF
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> CDF
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {laneBoxplots.length > 0 ? (
                  laneBoxplots.map((entry) => {
                    const scale = (value: number) => (laneBoxMax > 0 ? (value / laneBoxMax) * 100 : 0);
                    const whiskerStart = scale(entry.min);
                    const whiskerEnd = scale(entry.max);
                    const boxStart = scale(entry.q1);
                    const boxEnd = scale(entry.q3);
                    const median = scale(entry.median);
                    return (
                      <div key={entry.laneId} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span className="font-semibold text-zinc-200">{entry.label}</span>
                          <span>{entry.sampleCount} samples</span>
                        </div>
                        <div className="relative h-8 rounded-md border border-zinc-800/80 bg-zinc-950/40">
                          <div
                            className="absolute top-1/2 h-px -translate-y-1/2 bg-zinc-700"
                            style={{ left: `${Math.min(whiskerStart, whiskerEnd)}%`, width: `${Math.max(Math.abs(whiskerEnd - whiskerStart), 1)}%` }}
                          />
                          <div
                            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-zinc-600"
                            style={{ left: `${whiskerStart}%` }}
                          />
                          <div
                            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-zinc-600"
                            style={{ left: `${whiskerEnd}%` }}
                          />
                          <div
                            className="absolute inset-y-[18%] rounded-sm border border-emerald-500/60 bg-emerald-500/20"
                            style={{ left: `${boxStart}%`, width: `${Math.max(boxEnd - boxStart, 1)}%` }}
                          />
                          <div
                            className="absolute inset-y-[12%] w-px bg-emerald-300"
                            style={{ left: `${median}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>min {formatMicros(entry.min)}</span>
                          <span>p25 {formatMicros(entry.q1)}</span>
                          <span>p50 {formatMicros(entry.median)}</span>
                          <span>p75 {formatMicros(entry.q3)}</span>
                          <span>max {formatMicros(entry.max)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-zinc-500">
                    Compute samples per SSD will plot here once the simulation runs.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
              <div className="border-b border-zinc-800/60 px-6 py-3 text-sm font-semibold">Aggregation Tree</div>
              <div className="px-6 py-4">{renderAggregationTree(result.aggregationTree)}</div>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
              <div className="border-b border-zinc-800/60 px-6 py-3 text-sm font-semibold">Derived Parameters</div>
              <div className="space-y-2 px-6 py-4 text-xs text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Total chunks</span>
                  <span className="font-semibold text-zinc-200">{result.derived.totalChunks}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stripes per object</span>
                  <span className="font-semibold text-zinc-200">{result.derived.stripes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Chunk bytes</span>
                  <span className="font-semibold text-zinc-200">{(result.derived.chunkBytes / 1024).toFixed(0)} KiB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Aggregation location</span>
                  <span className="font-semibold text-zinc-200">{aggregationLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Aggregator per stripe</span>
                  <span className="font-semibold text-zinc-200">{formatMicros(result.derived.aggregatorPerStripeUs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Aggregator total</span>
                  <span className="font-semibold text-zinc-200">{formatMicros(result.derived.aggregatorTotalUs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>SSD compute critical path</span>
                  <span className="font-semibold text-zinc-200">{formatMicros(result.derived.ssdComputeCriticalPathUs)}</span>
                </div>
                {result.derived.ssdAggregateCriticalPathUs > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Aggregation critical path</span>
                    <span className="font-semibold text-zinc-200">{formatMicros(result.derived.ssdAggregateCriticalPathUs)}</span>
                  </div>
                )}
                {hasPipelineEstimates && (
                  <div className="flex items-center justify-between">
                    <span>Conservative serial latency</span>
                    <span className="font-semibold text-zinc-200">
                      {formatMicros(Math.max(result.derived.pipelineFillUs ?? 0, result.derived.steadyStateUs ?? 0))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Queue depth</span>
                  <span className="font-semibold text-zinc-200">{draftScenario.queueDepth}</span>
                </div>
                {calibrationSummary && (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Calibration profile</span>
                      <span className="font-semibold text-zinc-200">{calibrationSummary.label ?? '—'}</span>
                    </div>
                    {calibrationSummary.muPer4kUs !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>μ per 4 KiB</span>
                        <span className="font-semibold text-zinc-200">{formatMicros(calibrationSummary.muPer4kUs)}</span>
                      </div>
                    )}
                    {calibrationSummary.sigmaPer4kUs !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>σ per 4 KiB</span>
                        <span className="font-semibold text-zinc-200">{formatMicros(calibrationSummary.sigmaPer4kUs)}</span>
                      </div>
                    )}
                    {calibrationSummary.sampleCount !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Calibration samples</span>
                        <span className="font-semibold text-zinc-200">{calibrationSummary.sampleCount}</span>
                      </div>
                    )}
                    {calibrationSummary.tolerancePercent !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Tolerance window</span>
                        <span className="font-semibold text-zinc-200">{calibrationSummary.tolerancePercent}%</span>
                      </div>
                    )}
                    {confidence?.latency?.margin && confidence.latency.margin > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Latency margin (CI)</span>
                        <span className="font-semibold text-zinc-200">{formatMicros(confidence.latency.margin)}</span>
                      </div>
                    )}
                    {calibrationSummary.warnings && calibrationSummary.warnings.length > 0 && (
                      <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                        {calibrationSummary.warnings.map((warning) => (
                          <div key={warning}>{warning}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
              <div className="text-sm font-semibold">Event Log & Failure Runbook</div>
              <button
                onClick={onToggleEvents}
                className="text-[11px] font-medium text-sky-300 hover:text-sky-200"
                aria-expanded={eventsOpen}
              >
                {eventsOpen ? 'Hide details' : 'Show details'}
              </button>
            </div>
            {eventsOpen && (
              <div className="grid gap-4 px-6 py-4 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 text-xs text-zinc-400">
                  {result.events.map((event) => (
                    <div
                      key={`${event.timeUs}-${event.message}`}
                      className={cn('flex items-start gap-2', event.type === 'warning' && 'text-amber-300')}
                    >
                      <span className="font-mono text-[10px] text-zinc-500">{formatMicros(event.timeUs)}</span>
                      <span>{event.message}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 text-xs text-zinc-400">
                  {result.runbook.length === 0 ? (
                    <div className="text-zinc-500">No retry events captured for this run.</div>
                  ) : (
                    result.runbook.map((entry) => (
                      <div key={entry.id} className="flex flex-col border-b border-zinc-800/40 pb-2 last:border-none last:pb-0">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>{formatMicros(entry.timeUs)}</span>
                          <span>
                            SSD {entry.laneId.replace('ssd-', '')} · Obj {entry.objectIndex + 1} · Attempt {entry.attempt}
                          </span>
                        </div>
                        <div className="text-zinc-200">{entry.message}</div>
                        <div className="text-[10px] text-zinc-500">Delay {formatMicros(entry.retryDelayUs)} · Added {formatMicros(entry.additionalLatencyUs)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const computeMdtsSegments = (scenario: EnterpriseScenario): number => {
  const chunkBytes = scenario.chunkSizeKB * 1024;
  const mdts = Math.max(1, scenario.mdtsBytes);
  return Math.max(1, Math.ceil(chunkBytes / mdts));
};
