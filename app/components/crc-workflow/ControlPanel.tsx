'use client';

import React from 'react';
import { WorkflowState, SolutionType, SOLUTIONS } from '@/app/types/crc-workflow';

interface ControlPanelProps {
  state: WorkflowState;
  setState: React.Dispatch<React.SetStateAction<WorkflowState>>;
}

const clamp = (v: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, v));
};

export default function ControlPanel({ state, setState }: ControlPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--grid)] rounded-[10px] shadow-[0_4px_14px_var(--shadow)] p-[14px] sticky top-[14px] max-h-[calc(100vh-28px)] overflow-auto">
      {/* Workflow Section */}
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] my-[10px]">
        Workflow
      </h2>
      
      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="solution" className="text-[13px] text-[var(--fg)]">Solution:</label>
        <select
          id="solution"
          value={state.solution}
          onChange={(e) => setState({ ...state, solution: e.target.value as SolutionType })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        >
          {Object.entries(SOLUTIONS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="width" className="text-[13px] text-[var(--fg)]">Stripe width (W):</label>
        <input
          id="width"
          type="number"
          min="2"
          max="16"
          step="1"
          value={state.W}
          onChange={(e) => setState({ ...state, W: clamp(parseInt(e.target.value || '6'), 2, 16) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="segments" className="text-[13px] text-[var(--fg)]">MDTS segments per extent:</label>
        <input
          id="segments"
          type="number"
          min="1"
          max="4"
          step="1"
          value={state.segments}
          onChange={(e) => setState({ ...state, segments: clamp(parseInt(e.target.value || '1'), 1, 4) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="chunk" className="text-[13px] text-[var(--fg)]">Chunk size (bytes):</label>
        <input
          id="chunk"
          type="number"
          min="512"
          max="134217728"
          step="512"
          value={state.chunkBytes}
          onChange={(e) => setState({ ...state, chunkBytes: clamp(parseInt(e.target.value || '4096'), 512, 134217728) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="aggIndex" className="text-[13px] text-[var(--fg)]">
          Aggregator index (k): <span className="text-[var(--muted)]">(0 .. W-1)</span>
        </label>
        <input
          id="aggIndex"
          type="number"
          min="0"
          max={Math.max(0, state.W - 1)}
          step="1"
          value={state.aggIndex}
          onChange={(e) => setState({ ...state, aggIndex: clamp(parseInt(e.target.value || '0'), 0, Math.max(0, state.W - 1)) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      {/* Timing Model Section */}
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] my-[10px]">
        Timing model (µs)
      </h2>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="lat" className="text-[13px] text-[var(--fg)]">PCIe/command latency (one-way):</label>
        <input
          id="lat"
          type="number"
          min="1"
          max="200"
          step="1"
          value={state.lat}
          onChange={(e) => setState({ ...state, lat: clamp(parseFloat(e.target.value || '15'), 1, 200) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="dev" className="text-[13px] text-[var(--fg)]">SSD CRC compute (per chunk):</label>
        <input
          id="dev"
          type="number"
          min="10"
          max="2000"
          step="10"
          value={state.dev}
          onChange={(e) => setState({ ...state, dev: clamp(parseFloat(e.target.value || '250'), 10, 2000) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="hostc" className="text-[13px] text-[var(--fg)]">Host combine (per stage):</label>
        <input
          id="hostc"
          type="number"
          min="5"
          max="1000"
          step="5"
          value={state.hostc}
          onChange={(e) => setState({ ...state, hostc: clamp(parseFloat(e.target.value || '40'), 5, 1000) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-[1fr_90px] gap-2 items-center my-[10px]">
        <label htmlFor="aggc" className="text-[13px] text-[var(--fg)]">SSD aggregate (per element):</label>
        <input
          id="aggc"
          type="number"
          min="1"
          max="200"
          step="1"
          value={state.aggc}
          onChange={(e) => setState({ ...state, aggc: clamp(parseFloat(e.target.value || '6'), 1, 200) })}
          className="w-full px-2 py-[6px] bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg text-[var(--fg)] text-[13px]"
        />
      </div>

      {/* Options Section */}
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] my-[10px]">
        Options
      </h2>

      <div className="flex items-center gap-[10px] text-[13px] my-2">
        <input
          id="showError"
          type="checkbox"
          checked={state.showError}
          onChange={(e) => setState({ ...state, showError: e.target.checked })}
        />
        <label htmlFor="showError">Simulate error & retry</label>
      </div>

      <div className="flex items-center gap-[10px] text-[13px] my-2">
        <input
          id="labels"
          type="checkbox"
          checked={state.showLabels}
          onChange={(e) => setState({ ...state, showLabels: e.target.checked })}
        />
        <label htmlFor="labels">Show seeds/lengths in labels</label>
      </div>

      <div className="flex items-center gap-[10px] text-[13px] my-2">
        <input
          id="random"
          type="checkbox"
          checked={state.randomize}
          onChange={(e) => setState({ ...state, randomize: e.target.checked })}
        />
        <label htmlFor="random">Randomize device durations</label>
      </div>

      <div className="flex items-center gap-[10px] text-[13px] my-2">
        <input
          id="dark"
          type="checkbox"
          checked={state.dark}
          onChange={(e) => setState({ ...state, dark: e.target.checked })}
        />
        <label htmlFor="dark">Dark mode</label>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-[10px]">
        <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-2 py-[6px] text-xs">
          ➜ <strong>OK path</strong> (green)
        </div>
        <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-2 py-[6px] text-xs">
          ➜ <strong>Error/Retry</strong> (red)
        </div>
        <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-2 py-[6px] text-xs">
          ▮ <strong>Compute</strong> (activity bar)
        </div>
        <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-2 py-[6px] text-xs">
          ▮ <strong>Note</strong> (host/internal)
        </div>
      </div>
    </div>
  );
}