'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ENTERPRISE_PHASE1_PRESET,
  Phase1Scenario,
  SimulationResult,
  simulatePhase1,
  TimelineLane,
  TimelineSegment,
} from '@/lib/enterprise/phase1';
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

const segmentColor = (segment: TimelineSegment): string => {
  switch (segment.kind) {
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

const modePillClasses =
  'rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-zinc-300';

const cloneScenario = (scenario: Phase1Scenario): Phase1Scenario => ({
  ...scenario,
  hostCoefficients: { ...scenario.hostCoefficients },
});

const computeMdtsSegments = (scenario: Phase1Scenario): number => {
  const chunkBytes = scenario.chunkSizeKB * 1024;
  const mdts = Math.max(1, scenario.mdtsBytes);
  return Math.max(1, Math.ceil(chunkBytes / mdts));
};

const EnterpriseTab: React.FC = () => {
  const [draftScenario, setDraftScenario] = useState<Phase1Scenario>(ENTERPRISE_PHASE1_PRESET);
  const [committedScenario, setCommittedScenario] = useState<Phase1Scenario>(ENTERPRISE_PHASE1_PRESET);
  const [showCritical, setShowCritical] = useState<boolean>(false);
  const [eventsOpen, setEventsOpen] = useState<boolean>(true);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const result: SimulationResult = useMemo(() => simulatePhase1(committedScenario), [committedScenario]);
  const total = result.derived.totalLatencyUs || 1;
  const mdtsSegments = computeMdtsSegments(draftScenario);
  const mdtsClamp = draftScenario.chunkSizeKB * 1024 > draftScenario.mdtsBytes;

  const handleRun = () => {
    setImportError(null);
    setCommittedScenario(cloneScenario(draftScenario));
  };

  const handlePreset = () => {
    setImportError(null);
    setDraftScenario(ENTERPRISE_PHASE1_PRESET);
    setCommittedScenario(ENTERPRISE_PHASE1_PRESET);
  };

  const updateScenario = (update: Partial<Phase1Scenario>) => {
    setImportError(null);
    setDraftScenario((prev) => ({
      ...prev,
      ...update,
      hostCoefficients: update.hostCoefficients ? { ...update.hostCoefficients } : prev.hostCoefficients,
    }));
  };

  const updateHostCoefficient = (key: 'c0' | 'c1' | 'c2', value: number) => {
    setImportError(null);
    setDraftScenario((prev) => ({
      ...prev,
      hostCoefficients: {
        ...prev.hostCoefficients,
        [key]: value,
      },
    }));
  };

  const handleExport = () => {
    const scenarioToExport = cloneScenario(result.scenario);
    const blob = new Blob([JSON.stringify(scenarioToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crc_enterprise_s2_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  };

  const handleImportClick = () => {
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const parsed = JSON.parse(text) as Phase1Scenario;
        const normalised = simulatePhase1(parsed).scenario;
        setDraftScenario(cloneScenario(normalised));
        setCommittedScenario(cloneScenario(normalised));
        setImportError(null);
      } catch (error) {
        console.error('Unable to import scenario', error);
        setImportError('Unable to import scenario – please ensure this file was generated from the simulator.');
      }
    };
    reader.onerror = () => {
      setImportError('Unable to read scenario file.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={modePillClasses}>Single Solution</span>
          <span className="text-xs text-zinc-500">Phase 1 · Deterministic · Host Aggregation</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Export JSON
          </button>
          <button
            onClick={handleImportClick}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            Import JSON
          </button>
          <button
            onClick={() => setShowCritical((prev) => !prev)}
            className={cn(
              'rounded-full border border-zinc-700 px-3 py-1 text-xs transition-colors',
              showCritical ? 'bg-amber-500/30 text-amber-200' : 'hover:bg-zinc-800',
            )}
          >
            {showCritical ? 'Critical Path ✓' : 'Highlight Critical Path'}
          </button>
          <button
            onClick={handleRun}
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
        onChange={handleImportFile}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[340px_1fr]">
          <aside className="overflow-y-auto border-r border-zinc-900 bg-zinc-950/40 p-4">
            <div className="space-y-6">
              <Section title="Topology">
                <NumberSlider
                  id="stripeWidth"
                  label="Stripe Width (x)"
                  value={draftScenario.stripeWidth}
                  min={1}
                  max={32}
                  step={1}
                  onChange={(value) => updateScenario({ stripeWidth: value })}
                />
                <NumberSlider
                  id="objectsInFlight"
                  label="Objects in Flight"
                  value={draftScenario.objectsInFlight}
                  min={1}
                  max={8}
                  step={1}
                  onChange={(value) => updateScenario({ objectsInFlight: value })}
                  helper="Phase 1 models a single object; additional fan-in coming in Phase 3."
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
                  onChange={(value) => updateScenario({ fileSizeMB: value })}
                />
                <NumberSlider
                  id="chunkSize"
                  label="Chunk Size"
                  value={draftScenario.chunkSizeKB}
                  min={4}
                  max={1024}
                  step={4}
                  unit="KiB"
                  onChange={(value) => updateScenario({ chunkSizeKB: value })}
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
                    onChange={(value) => updateScenario({ queueDepth: value })}
                    disabled
                    helper="Phase 1 keeps a single outstanding command per SSD; queueing unlocks with stochastic mode."
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
                <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Solution</div>
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        className="flex items-center justify-between rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-left text-xs text-sky-200"
                      >
                        <span>S2 · Parallel CRC + Host Aggregation</span>
                        <span className="text-[10px] uppercase tracking-wide">Active</span>
                      </button>
                      <button
                        type="button"
                        className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-left text-xs text-zinc-500"
                        title="Solutions 1 and 3 unlock in Phase 2"
                        disabled
                      >
                        <span>S1 · Serial with Seeding</span>
                        <span className="text-[10px] uppercase tracking-wide">Locked</span>
                      </button>
                      <button
                        type="button"
                        className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-left text-xs text-zinc-500"
                        title="Solutions 1 and 3 unlock in Phase 2"
                        disabled
                      >
                        <span>S3 · Parallel + SSD Aggregation</span>
                        <span className="text-[10px] uppercase tracking-wide">Locked</span>
                      </button>
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
                      onChange={(value) => updateHostCoefficient('c0', value)}
                    />
                    <NumberSlider
                      id="c1"
                      label="c1 (per stripe)"
                      value={draftScenario.hostCoefficients.c1}
                      min={0}
                      max={10}
                      step={0.1}
                      unit="µs"
                      onChange={(value) => updateHostCoefficient('c1', value)}
                    />
                    <NumberSlider
                      id="c2"
                      label="c2 (log₂ term)"
                      value={draftScenario.hostCoefficients.c2}
                      min={0}
                      max={20}
                      step={0.5}
                      unit="µs"
                      onChange={(value) => updateHostCoefficient('c2', value)}
                    />
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
                  onClick={handlePreset}
                  className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-400/20"
                >
                  Load Baseline 8× Gen4x4 (Deterministic)
                </button>
              </Section>
            </div>
          </aside>

          <section className="flex h-full flex-col overflow-hidden">
            <div className="grid gap-4 border-b border-zinc-900 bg-zinc-950/40 px-6 py-4 md:grid-cols-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Latency p50 / p95 / p99</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-100">{formatMicros(result.kpis.latencyUs)}</div>
                <div className="text-xs text-zinc-500">Deterministic in Phase 1</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Throughput</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-100">{formatObjectsPerSecond(result.kpis.throughputObjsPerSec)}</div>
                <div className="text-xs text-zinc-500">Objects per second</div>
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
                            entry.label.includes('Host') && 'bg-amber-400',
                            entry.label.includes('SSD') && 'bg-emerald-500',
                            entry.label.includes('Orchestration') && 'bg-purple-500',
                          )}
                          style={{ width: `${Math.min(100, entry.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">Timeline (Gantt)</h3>
                    <p className="text-xs text-zinc-500">One lane per SSD plus host aggregation lane.</p>
                  </div>
                  <div className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-500">
                    Object latency {formatMicros(result.derived.totalLatencyUs)}
                  </div>
                </div>

                <div className="space-y-3">
                  {result.lanes.map((lane: TimelineLane) => {
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
                                  segmentColor(segment),
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
                onClick={() => setEventsOpen((prev) => !prev)}
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
                      <span>Agg_host (total)</span>
                      <span className="font-semibold text-zinc-200">{formatMicros(result.derived.aggregatorUs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Agg_host / stripe</span>
                      <span className="font-semibold text-zinc-200">{formatMicros(result.derived.aggregatorPerStripeUs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>SSD critical path</span>
                      <span className="font-semibold text-zinc-200">{formatMicros(result.derived.ssdCriticalPathUs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Queue depth</span>
                      <span className="font-semibold text-zinc-200">{draftScenario.queueDepth}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseTab;
