'use client';

import React from 'react';
import {
  EnterpriseScenario,
  SimulationResult,
  AggregationTree,
  EnterpriseSolution,
  AggregatorPolicy,
  AggregationLocation,
} from '@/lib/enterprise/phase2';
import { cn } from '@/lib/utils';

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
}) => {
  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = parseFloat(event.target.value);
    if (Number.isFinite(numeric)) {
      const clamped = Math.max(min, Math.min(max, numeric));
      onChange(clamped);
    }
  };

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
          <span>{value.toFixed(value % 1 === 0 ? 0 : 1)}</span>
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

const segmentColor = (kind: 'io' | 'compute' | 'aggregation' | 'finalize'): string => {
  switch (kind) {
    case 'compute':
      return 'bg-emerald-500/70 text-emerald-50';
    case 'aggregation':
      return 'bg-amber-400/80 text-zinc-900';
    case 'finalize':
      return 'bg-sky-500/70 text-zinc-900';
    default:
      return 'bg-blue-500/40 text-blue-50';
  }
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
  onPreset: () => void;
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  draftScenario,
  mdtsSegments,
  mdtsClamp,
  onUpdateScenario,
  onUpdateHostCoefficient,
  onUpdateSsdCoefficient,
  onPreset,
}) => {
  return (
    <div className="space-y-6 p-4">
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
          max={8}
          step={1}
          onChange={(value) => onUpdateScenario({ objectsInFlight: value })}
          helper="Deterministic slice keeps one object; multi-object fan-in lands with Phase 3."
          disabled
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
              {(draftScenario.mdtsBytes / 1024).toFixed(0)} KiB (read-only)
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
            disabled
            helper="Phase 2 keeps a single outstanding command per SSD; queueing unlocks with stochastic mode."
          />
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Threads</span>
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
              {draftScenario.threads} (display)
            </span>
          </div>
        </div>
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
              helper="Used by S2 when aggregation stays on the host."
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
              max={100}
              step={0.5}
              unit="µs"
              onChange={(value) => onUpdateSsdCoefficient('d0', value)}
              highlight={draftScenario.solution === 's3'}
              helper="Applies when S3 routes aggregation onto an SSD."
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

      <Section title="Failures & Jitter" disabled tooltip="Phase 3 introduces jitter, stragglers, and retry modeling.">
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-[11px] text-zinc-500">
          Deterministic run. Failure knobs unlock with stochastic engine.
        </p>
      </Section>

      <Section title="Calibration" disabled tooltip="Phase 4 enables log-based calibration profiles.">
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-[11px] text-zinc-500">
          Use captured traces to align simulator with fleet telemetry.
        </p>
      </Section>

      <Section title="Presets">
        <button
          onClick={onPreset}
          className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-400/20"
        >
          Load Baseline 8× Gen4x4 (Deterministic)
        </button>
      </Section>
    </div>
  );
};


export interface EnterpriseResultsProps {
  result: SimulationResult;
  draftScenario: EnterpriseScenario;
  showCritical: boolean;
  onToggleCritical: () => void;
  eventsOpen: boolean;
  onToggleEvents: () => void;
  onRun: () => void;
  onExportScenario: () => void;
  onExportResults: () => void;
  onImportClick: () => void;
  importError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
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

export const EnterpriseResults: React.FC<EnterpriseResultsProps> = ({
  result,
  draftScenario,
  showCritical,
  onToggleCritical,
  eventsOpen,
  onToggleEvents,
  onRun,
  onExportScenario,
  onExportResults,
  onImportClick,
  importError,
  fileInputRef,
  onImportFile,
}) => {
  const total = result.derived.totalLatencyUs || 1;
  const solution = result.scenario.solution;
  const solutionMeta = SOLUTION_META[solution];
  const aggregationLabel = AGGREGATION_LOCATION_LABEL[result.derived.aggregatorLocation];
  const aggregatorPolicyLabel = solution === 's3' ? AGGREGATOR_POLICY_META[result.scenario.aggregatorPolicy] : null;
  const hasPipelineEstimates =
    typeof result.derived.pipelineFillUs === 'number' && typeof result.derived.steadyStateUs === 'number';

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-zinc-300">
            Single Solution
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-200">{solutionMeta.label}</div>
            <div className="text-[11px] text-zinc-500">Phase 2 · Deterministic · {aggregationLabel}</div>
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
            onClick={onImportClick}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Import JSON
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
            className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-sky-400"
          >
            Run Simulation
          </button>
        </div>
      </div>

      {importError && (
        <div className="bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
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

      <div className="grid gap-4 border-b border-zinc-900 bg-zinc-950/40 px-6 py-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Latency p50 / p95 / p99</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-100">{formatMicros(result.kpis.latencyUs)}</div>
          <div className="text-xs text-zinc-500">Deterministic slice (Phase 2)</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Throughput</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-100">{formatObjectsPerSecond(result.kpis.throughputObjsPerSec)}</div>
          <div className="text-xs text-zinc-500">Objects per second at computed latency</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 md:col-span-2">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Critical Path Breakdown</div>
          <div className="mt-2 space-y-2">
            {result.kpis.criticalPath.map((entry) => (
              <div key={entry.label}>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{entry.label}</span>
                  <span>{entry.percent.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      'h-full rounded-full bg-sky-500 transition-all duration-500',
                      entry.label.toLowerCase().includes('host') && 'bg-amber-400',
                      entry.label.toLowerCase().includes('ssd') && 'bg-emerald-500',
                      entry.label.toLowerCase().includes('orchestration') && 'bg-purple-500',
                      entry.label.toLowerCase().includes('serial') && 'bg-fuchsia-500',
                    )}
                    style={{ width: `${Math.min(100, entry.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-900 bg-zinc-950/50 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Aggregation Tree</h3>
            <p className="text-xs text-zinc-500">{solutionMeta.description}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span>Total {formatMicros(result.aggregationTree.totalUs)}</span>
            {aggregatorPolicyLabel && <span>Policy · {aggregatorPolicyLabel}</span>}
          </div>
        </div>
        <div className="mt-3">{renderAggregationTree(result.aggregationTree)}</div>
        {hasPipelineEstimates && (
          <div className="mt-3 grid gap-2 text-[11px] text-zinc-400 md:grid-cols-2">
            <div className="rounded border border-zinc-900 bg-zinc-950/30 p-2">
              <div className="font-semibold uppercase tracking-wide text-zinc-500">Pipeline fill</div>
              <div className="mt-1 text-sm text-zinc-100">{formatMicros(result.derived.pipelineFillUs ?? 0)}</div>
              <div className="text-[10px] text-zinc-500">Time to seed across the stripe once.</div>
            </div>
            <div className="rounded border border-zinc-900 bg-zinc-950/30 p-2">
              <div className="font-semibold uppercase tracking-wide text-zinc-500">Steady state</div>
              <div className="mt-1 text-sm text-zinc-100">{formatMicros(result.derived.steadyStateUs ?? 0)}</div>
              <div className="text-[10px] text-zinc-500">Per-object latency in the filled pipeline.</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Timeline (Gantt)</h3>
              <p className="text-xs text-zinc-500">One lane per SSD plus host validation lane.</p>
            </div>
            <div className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-500">
              Object latency {formatMicros(result.derived.totalLatencyUs)}
            </div>
          </div>

          <div className="space-y-3">
            {result.lanes.map((lane) => {
              const isHost = lane.role === 'host';
              const emphasise = !showCritical || lane.isCritical || isHost;
              return (
                <div key={lane.id} className="space-y-2 rounded-lg border border-zinc-900 bg-zinc-950/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
                          isHost ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200',
                        )}
                      >
                        {lane.label}
                      </span>
                      {lane.isCritical && !isHost && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                          Critical
                        </span>
                      )}
                    </div>
                    <span className="text-zinc-500">{formatMicros(lane.totalUs)}</span>
                  </div>
                  <div className="relative h-12 overflow-hidden rounded-md border border-zinc-900 bg-zinc-950">
                    {lane.segments.map((segment) => {
                      const width = ((segment.endUs - segment.startUs) / total) * 100;
                      const left = (segment.startUs / total) * 100;
                      return (
                        <div
                          key={`${lane.id}-${segment.startUs}-${segment.endUs}-${segment.kind}-${segment.commandIndex}`}
                          className={cn(
                            'absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded px-2 text-[10px] transition-opacity',
                            segmentColor(segment.kind),
                            emphasise ? 'opacity-100' : 'opacity-20',
                          )}
                          style={{
                            width: `${Math.max(width, 0.6)}%`,
                            left: `${left}%`,
                          }}
                          title={`${segment.label} (${formatMicros(segment.endUs - segment.startUs)})`}
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

      <div className="border-t border-zinc-900 bg-zinc-950/40 px-6 py-3">
        <button
          onClick={onToggleEvents}
          className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-zinc-400"
        >
          <span>Event Log & Derived Parameters</span>
          <span>{eventsOpen ? '▾' : '▸'}</span>
        </button>
        {eventsOpen && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-zinc-900 bg-zinc-950/30 p-3 text-xs text-zinc-400">
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
            <div className="space-y-2 rounded-lg border border-zinc-900 bg-zinc-950/30 p-3 text-xs text-zinc-400">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const computeMdtsSegments = (scenario: EnterpriseScenario): number => {
  const chunkBytes = scenario.chunkSizeKB * 1024;
  const mdts = Math.max(1, scenario.mdtsBytes);
  return Math.max(1, Math.ceil(chunkBytes / mdts));
};
