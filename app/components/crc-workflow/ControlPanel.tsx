'use client';

import React from 'react';
import { WorkflowState, SolutionType, SOLUTIONS } from '@/app/types/crc-workflow';
import { motion, AnimatePresence } from 'framer-motion';

interface ControlPanelProps {
  state: WorkflowState;
  setState: React.Dispatch<React.SetStateAction<WorkflowState>>;
}

const clamp = (v: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, v));
};

interface SliderInputProps {
  id: string;
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

function SliderInput({ id, label, value, onChange, min, max, step = 1, unit = '' }: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="my-4">
      <div className="flex justify-between items-center mb-2">
        <label htmlFor={id} className="text-xs text-[var(--fg)]">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(clamp(parseFloat(e.target.value || '0'), min, max))}
            className="w-16 px-1 py-0.5 bg-[var(--panel-2)] border border-[var(--grid)] rounded-md text-[var(--fg)] text-xs text-right"
            min={min}
            max={max}
            step={step}
          />
          {unit && <span className="text-[10px] text-[var(--muted)]">{unit}</span>}
        </div>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="slider w-full"
          style={{
            background: `linear-gradient(to right, var(--accent) ${percentage}%, var(--grid) ${percentage}%)`
          }}
        />
      </div>
    </div>
  );
}

function ToggleSwitch({ id, label, checked, onChange }: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <motion.div 
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--panel-2)] transition-colors"
      whileHover={{ x: 2 }}
    >
      <label htmlFor={id} className="text-xs cursor-pointer select-none flex-1">{label}</label>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        style={{
          backgroundColor: checked ? 'var(--accent)' : 'var(--grid)',
        }}
      >
        <span className="sr-only">{label}</span>
        <motion.span
          className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0"
          animate={{
            x: checked ? 24 : 4,
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
        />
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
      </button>
    </motion.div>
  );
}

export default function ControlPanel({ state, setState }: ControlPanelProps) {
  const solutions = Object.entries(SOLUTIONS);
  
  return (
    <motion.div
      className="bg-[var(--panel)] p-4 h-full overflow-y-auto"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <style jsx global>{`
        .slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
          outline: none;
          transition: all 0.2s;
        }
        
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 0 8px rgba(89, 168, 255, 0.1);
        }
        
        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 0 8px rgba(89, 168, 255, 0.1);
        }
        
        .solution-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .solution-card:hover {
          transform: translateX(2px);
        }
        
        .solution-card.active {
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          color: white;
        }
        
        /* Modern toggle switch enhancements */
        button[role="switch"] {
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
        }
        
        button[role="switch"]:hover {
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.1);
        }
        
        button[role="switch"][aria-checked="true"] {
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(89, 168, 255, 0.2);
        }
      `}</style>

      {/* Solution Selector with Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
          Select Architecture
        </h2>
        
        <div className="space-y-2">
          {solutions.map(([key, label], idx) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`solution-card p-2 rounded-lg border ${
                state.solution === key 
                  ? 'active border-[var(--accent)]' 
                  : 'bg-[var(--panel-2)] border-[var(--grid)]'
              }`}
              onClick={() => setState({ ...state, solution: key as SolutionType })}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{label}</span>
                {state.solution === key && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-lg"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Workflow Parameters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6"
      >
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
          Workflow Parameters
        </h2>
        
        <SliderInput
          id="width"
          label={<span>Stripe Width <span className="text-[var(--muted)]">(W)</span></span>}
          value={state.W}
          onChange={(v) => setState({ ...state, W: v, aggIndex: Math.min(state.aggIndex, v - 1) })}
          min={2}
          max={16}
          step={1}
        />
        
        <SliderInput
          id="segments"
          label="MDTS Segments"
          value={state.segments}
          onChange={(v) => setState({ ...state, segments: v })}
          min={1}
          max={4}
          step={1}
        />
        
        <SliderInput
          id="chunk"
          label="Chunk Size"
          value={state.chunkBytes}
          onChange={(v) => setState({ ...state, chunkBytes: v })}
          min={512}
          max={32768}
          step={512}
          unit="bytes"
        />
        
        <AnimatePresence>
          {state.solution === 's3' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <SliderInput
                id="aggIndex"
                label={<span>Aggregator SSD <span className="text-[var(--muted)]">(k)</span></span>}
                value={state.aggIndex}
                onChange={(v) => setState({ ...state, aggIndex: v })}
                min={0}
                max={Math.max(0, state.W - 1)}
                step={1}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Timing Model */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
          Timing Model (µs)
        </h2>
        
        <SliderInput
          id="lat"
          label="PCIe Latency"
          value={state.lat}
          onChange={(v) => setState({ ...state, lat: v })}
          min={1}
          max={200}
          step={1}
          unit="µs"
        />
        
        <SliderInput
          id="dev"
          label="SSD CRC Compute"
          value={state.dev}
          onChange={(v) => setState({ ...state, dev: v })}
          min={10}
          max={2000}
          step={10}
          unit="µs"
        />
        
        <SliderInput
          id="hostc"
          label="Host Combine (all shards)"
          value={state.hostc}
          onChange={(v) => setState({ ...state, hostc: v })}
          min={5}
          max={1000}
          step={5}
          unit="µs"
        />
        
        <SliderInput
          id="aggc"
          label="SSD agg time/shard"
          value={state.aggc}
          onChange={(v) => setState({ ...state, aggc: v })}
          min={1}
          max={200}
          step={1}
          unit="µs"
        />
      </motion.div>

      {/* Options */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6"
      >
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
          Display Options
        </h2>
        
        <div className="space-y-0.5 bg-[var(--panel-2)] rounded-lg p-1">
          <ToggleSwitch
            id="showError"
            label="Simulate Error & Retry"
            checked={state.showError}
            onChange={(v) => setState({ ...state, showError: v })}
          />
          
          <ToggleSwitch
            id="labels"
            label="Show Detailed Labels"
            checked={state.showLabels}
            onChange={(v) => setState({ ...state, showLabels: v })}
          />
          
          <ToggleSwitch
            id="random"
            label="Randomize Durations"
            checked={state.randomize}
            onChange={(v) => setState({ ...state, randomize: v })}
          />
          
          <ToggleSwitch
            id="dark"
            label="Dark Mode"
            checked={state.dark}
            onChange={(v) => setState({ ...state, dark: v })}
          />
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 grid grid-cols-2 gap-2"
      >
        <div className="flex items-center gap-2 text-xs p-2 bg-[var(--panel-2)] rounded-lg">
          <div className="w-3 h-3 bg-[var(--ok)] rounded-sm"></div>
          <span>Success Path</span>
        </div>
        <div className="flex items-center gap-2 text-xs p-2 bg-[var(--panel-2)] rounded-lg">
          <div className="w-3 h-3 bg-[var(--err)] rounded-sm"></div>
          <span>Error/Retry</span>
        </div>
        <div className="flex items-center gap-2 text-xs p-2 bg-[var(--panel-2)] rounded-lg">
          <div className="w-3 h-3 bg-[var(--activity)] rounded-sm"></div>
          <span>Activity</span>
        </div>
        <div className="flex items-center gap-2 text-xs p-2 bg-[var(--panel-2)] rounded-lg">
          <div className="w-3 h-3 bg-[var(--note)] rounded-sm"></div>
          <span>Note</span>
        </div>
      </motion.div>
    </motion.div>
  );
}