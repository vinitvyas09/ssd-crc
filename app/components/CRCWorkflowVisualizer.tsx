'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { WorkflowState, TooltipState, initialState, SolutionType, SOLUTIONS } from '@/app/types/crc-workflow';
import { buildWorkflowModel } from '@/app/utils/workflow-model-builder';
import ControlPanel from '@/app/components/crc-workflow/ControlPanel';
import AnimatedSVGDiagram from '@/app/components/crc-workflow/AnimatedSVGDiagram';
import SVGDiagram from '@/app/components/crc-workflow/SVGDiagram';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'single' | 'compare' | 'timeline';

export default function CRCWorkflowVisualizer() {
  const [state, setState] = useState<WorkflowState>(initialState);
  // Initialize compare solution to be different from initial state solution
  const [compareSolution, setCompareSolution] = useState<SolutionType>(
    initialState.solution === 's1' ? 's2' : 's1'
  );
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [zoom, setZoom] = useState(1);
  const [showMinimap, setShowMinimap] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'latency' | 'throughput' | 'cpu'>('latency');
  const [currentStage, setCurrentStage] = useState<string>('Ready');
  const [animationProgress, setAnimationProgress] = useState(100); 
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dummyRef = useRef<SVGSVGElement>(null);

  // Apply dark/light mode with smooth transitions
  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    if (state.dark) {
      root.style.setProperty('--bg', '#050607');
      root.style.setProperty('--panel', '#0a0b0d');
      root.style.setProperty('--panel-2', '#0f1012');
      root.style.setProperty('--fg', '#f0f4f8');
      root.style.setProperty('--muted', '#8b95a7');
      root.style.setProperty('--grid', '#1a1d21');
      root.style.setProperty('--lane', '#0d0e10');
      root.style.setProperty('--note', '#1a1f26');
      root.style.setProperty('--activity', '#151a20');
      root.style.setProperty('--accent-hover', '#70b4ff');
    } else {
      root.style.setProperty('--bg', '#ffffff');
      root.style.setProperty('--panel', '#fafbfc');
      root.style.setProperty('--panel-2', '#f6f8fa');
      root.style.setProperty('--fg', '#0d1117');
      root.style.setProperty('--muted', '#57606a');
      root.style.setProperty('--grid', '#e1e4e8');
      root.style.setProperty('--lane', '#f6f8fa');
      root.style.setProperty('--note', '#eff2f5');
      root.style.setProperty('--activity', '#f0f3f6');
      root.style.setProperty('--accent-hover', '#3d94ff');
    }
  }, [state.dark]);

  // Build the workflow models
  const model = useMemo(() => buildWorkflowModel(state), [state]);
  const compareState = useMemo(() => ({ ...state, solution: compareSolution }), [state, compareSolution]);
  const compareModel = useMemo(() => buildWorkflowModel(compareState), [compareState]);

  // Animation logic
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    // Reset to 0 when starting
    setAnimationProgress(0);
    
    const startTime = Date.now();
    const duration = 5000 / playbackSpeed; // Adjust duration based on playback speed

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setAnimationProgress(progress);
      
      if (progress < 100) {
        requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isPlaying, playbackSpeed]);

  // Determine current stage based on animation progress
  useEffect(() => {
    const tmax = model.tmax || 100;
    const progress = (animationProgress / 100) * tmax;
    let stage = 'Initializing';

    const activeActivities = model.activities.filter(a => progress >= a.t0 && progress <= a.t1);
    const activeMessages = model.events.filter(e => progress >= e.t0 && progress <= e.t1);

    if (activeActivities.length > 0) {
      // SSD aggregation stage (s3)
      const aggSSD = activeActivities.find(a => (a.label || '').includes('Aggregate'));
      if (aggSSD) {
        stage = `SSD Aggregation (${aggSSD.lane.toUpperCase()})`;
      }

      // Host aggregation stage (s2) – host activity exists with empty label after our label cleanup
      const hostAct = activeActivities.find(a => a.lane === 'host');
      if (hostAct && !(hostAct.label || '').includes('Note')) {
        stage = 'Host Aggregation';
      }

      // SSD compute stage
      const ssdAct = activeActivities.find(a => a.lane.startsWith('ssd') && /CRC compute/i.test(a.label || ''));
      if (ssdAct) {
        const k = ssdAct.lane.replace('ssd', '');
        stage = `SSD${k} CRC compute`;
      }
    } else if (activeMessages.length > 0) {
      const msg = activeMessages[0];
      if (/CRC_Calc/.test(msg.label)) stage = 'Sending CRC request';
      else if (/Completion/.test(msg.label)) stage = 'Receiving CRC result';
      else if (/Retry/.test(msg.label)) stage = 'Retrying request';
      else if (/CRC_Combine/.test(msg.label)) stage = 'Sending aggregation request';
    }

    if (progress >= tmax * 0.95) stage = 'Validation complete';

    setCurrentStage(stage);
  }, [animationProgress, model]);

  // Smart tooltip positioning
  const updateTooltip = useCallback((e: React.MouseEvent, content: string) => {
    if (!containerRef.current) return;
    
    let x = e.clientX;
    let y = e.clientY - 40;

    const tooltipWidth = 320;
    const tooltipHeight = 100;
    
    if (x + tooltipWidth / 2 > window.innerWidth) {
      x = window.innerWidth - tooltipWidth / 2 - 20;
    } else if (x - tooltipWidth / 2 < 0) {
      x = tooltipWidth / 2 + 20;
    }
    
    if (y - tooltipHeight < 0) {
      y = e.clientY + 40;
    }
    
    setTooltip({ visible: true, x, y, content });
  }, []);

  // Export functions
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crc_workflow_${state.solution}_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }, [state.solution]);

  const exportPNG = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
    
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const rect = svgRef.current!.getBoundingClientRect();
      const scale = 2;
      canvas.width = (svgRef.current!.viewBox?.baseVal.width || rect.width) * scale;
      canvas.height = (svgRef.current!.viewBox?.baseVal.height || rect.height) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.scale(scale, scale);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#050607';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(blob => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `crc_workflow_${state.solution}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 100);
      }, 'image/png');
      
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  }, [state.solution]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setState(initialState);
    setZoom(1);
  }, []);

  // Generate deterministic mock performance data for SSR compatibility
  const performanceData = useMemo(() => {
    const points = 20;
    const baseLatency = Number(model.metrics.latency.replace(/[^0-9]/g, '')) * 0.8;
    
    // Use a deterministic pattern instead of Math.random()
    return Array.from({ length: points }, (_, i) => {
      // Create deterministic but varied values using sine waves and index
      const phase = (i / points) * Math.PI * 2;
      const variation1 = Math.sin(phase) * 0.5 + 0.5; // 0-1 range
      const variation2 = Math.sin(phase * 1.5 + 1) * 0.5 + 0.5; // 0-1 range
      const variation3 = Math.sin(phase * 0.8 + 2) * 0.5 + 0.5; // 0-1 range
      
      return {
        x: i * 5,
        latency: variation1 * 50 + baseLatency,
        throughput: variation2 * 30 + 70,
        cpu: variation3 * 20 + 30,
      };
    });
  }, [model]);

  return (
    <div className="crc-workflow-container" ref={containerRef}>
      <style jsx global>{`
        :root {
          --bg: #050607;
          --panel: #0a0b0d;
          --panel-2: #0f1012;
          --fg: #f0f4f8;
          --muted: #8b95a7;
          --accent: #59a8ff;
          --accent-hover: #70b4ff;
          --ok: #24d28a;
          --warn: #ffcc40;
          --err: #ff6b6b;
          --grid: #1a1d21;
          --lane: #0d0e10;
          --note: #1a1f26;
          --activity: #151a20;
          --shadow: rgba(0,0,0,0.4);
        }
        
        * {
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        
        .crc-workflow-container {
          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: 'SF Pro Display', Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        }
        
        .glass-panel {
          background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        
        .metric-glow {
          box-shadow: 0 0 40px rgba(89, 168, 255, 0.1), inset 0 0 20px rgba(89, 168, 255, 0.05);
        }
        
        .playback-control {
          background: linear-gradient(135deg, var(--panel), var(--panel-2));
          border: 1px solid var(--grid);
          transition: all 0.2s ease;
        }
        
        .playback-control:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        }
        
        .view-tab {
          position: relative;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .view-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .pulse-animation {
          animation: pulse 2s infinite;
        }
      `}</style>

      {/* Enhanced Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 glass-panel"
      >
        <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--grid)]">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] bg-clip-text text-transparent">
                  CRC Workflows
                </span>
                <span className="text-xs px-2 py-1 bg-[var(--panel-2)] rounded-full text-[var(--muted)]">
                  v2.0
                </span>
              </h1>
            </div>
            
            {/* View Mode Tabs */}
            <div className="flex items-center bg-[var(--panel-2)] rounded-lg p-1">
              {(['single', 'compare', 'timeline'] as ViewMode[]).map((mode) => (
                <motion.button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`view-tab ${viewMode === mode ? 'active bg-[var(--panel)] text-[var(--fg)]' : 'text-[var(--muted)]'} px-4 py-2 rounded-md text-sm font-medium capitalize`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {mode === 'single' && '🎯'}
                  {mode === 'compare' && '🔄'}
                  {mode === 'timeline' && '📊'}
                  {' ' + mode}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[var(--panel-2)] rounded-lg px-3 py-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsPlaying(!isPlaying)}
                className="playback-control w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ background: isPlaying ? 'var(--err)' : 'var(--ok)' }}
              >
                {isPlaying ? '⏸' : '▶'}
              </motion.button>
              
              <div className="flex flex-col">
                <span className="text-xs text-[var(--muted)]">Speed</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="bg-transparent text-sm text-[var(--fg)] outline-none"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="4">4x</option>
                </select>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMinimap(!showMinimap)}
                className="px-3 py-2 bg-[var(--panel-2)] rounded-lg text-sm"
                title="Toggle Minimap"
              >
                🗺️
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportSVG}
                className="px-3 py-2 bg-[var(--panel-2)] rounded-lg text-sm"
                title="Export SVG"
              >
                📄
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportPNG}
                className="px-3 py-2 bg-[var(--panel-2)] rounded-lg text-sm"
                title="Export PNG"
              >
                🖼️
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                className="px-3 py-2 bg-[var(--err)] text-white rounded-lg text-sm font-medium"
              >
                Reset
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-80 border-r border-[var(--grid)] bg-[var(--panel)] overflow-y-auto"
        >
          <ControlPanel state={state} setState={setState} />
        </motion.div>

        {/* Main Visualization Area */}
        <div className="flex-1 flex flex-col">
          {/* Performance Metrics Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-4 bg-gradient-to-b from-[var(--panel)] to-transparent border-b border-[var(--grid)]"
          >
            <div className="grid grid-cols-4 gap-4">
              {viewMode === 'compare' ? (
                // Compare mode: Show metrics for both simulations
                <>
                  {/* Left simulation metrics */}
                  <motion.div
                    className="glass-panel rounded-xl p-4 metric-glow"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Latency</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--accent)] text-white rounded-full">Sol {state.solution.slice(1)}</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--accent)]">
                      {model.metrics.latency}
                    </div>
                    <div className="mt-2 h-8">
                      <svg className="w-full h-full">
                        <polyline
                          points={performanceData.slice(-10).map((d, i) => `${i * 12},${32 - d.latency / 3}`).join(' ')}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          opacity="0.5"
                        />
                      </svg>
                    </div>
                  </motion.div>

                  <motion.div
                    className="glass-panel rounded-xl p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Throughput</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--accent)] text-white rounded-full">Sol {state.solution.slice(1)}</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--warn)]">
                      {model.metrics.throughput}
                    </div>
                    <div className="mt-2 flex items-end gap-1 h-8">
                      {[...Array(8)].map((_, i) => {
                        const height = ((Math.sin(i * 0.8) * 0.5 + 0.5) * 80 + 20);
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-[var(--warn)]"
                            style={{
                              height: `${height}%`,
                              opacity: 0.3 + i * 0.1
                            }}
                          />
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Right simulation metrics */}
                  <motion.div
                    className="glass-panel rounded-xl p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Latency</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--warn)] text-white rounded-full">Sol {compareSolution.slice(1)}</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--accent)]">
                      {compareModel.metrics.latency}
                    </div>
                    <div className="mt-2 h-8">
                      <svg className="w-full h-full">
                        <polyline
                          points={performanceData.slice(-10).map((d, i) => `${i * 12},${32 - d.latency / 3}`).join(' ')}
                          fill="none"
                          stroke="var(--warn)"
                          strokeWidth="2"
                          opacity="0.5"
                        />
                      </svg>
                    </div>
                  </motion.div>

                  <motion.div
                    className="glass-panel rounded-xl p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Throughput</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--warn)] text-white rounded-full">Sol {compareSolution.slice(1)}</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--warn)]">
                      {compareModel.metrics.throughput}
                    </div>
                    <div className="mt-2 flex items-end gap-1 h-8">
                      {[...Array(8)].map((_, i) => {
                        const height = ((Math.sin((i + 3) * 0.8) * 0.5 + 0.5) * 80 + 20);
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-[var(--warn)]"
                            style={{
                              height: `${height}%`,
                              opacity: 0.3 + i * 0.1
                            }}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              ) : (
                // Single mode: Show original 4 metrics
                <>
                  <motion.div
                    className="glass-panel rounded-xl p-4 metric-glow"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Latency</span>
                      <span className="text-xs text-[var(--ok)]">● Live</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--accent)]">
                      {model.metrics.latency}
                    </div>
                    <div className="mt-2 h-8">
                      <svg className="w-full h-full">
                        <polyline
                          points={performanceData.slice(-10).map((d, i) => `${i * 12},${32 - d.latency / 3}`).join(' ')}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          opacity="0.5"
                        />
                      </svg>
                    </div>
                  </motion.div>

                  <motion.div
                    className="glass-panel rounded-xl p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Throughput</span>
                      <span className="text-xs text-[var(--warn)]">▲ 12%</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--warn)]">
                      {model.metrics.throughput}
                    </div>
                    <div className="mt-2 flex items-end gap-1 h-8">
                      {[...Array(8)].map((_, i) => {
                        const height = ((Math.sin(i * 0.8) * 0.5 + 0.5) * 80 + 20);
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-[var(--warn)]"
                            style={{
                              height: `${height}%`,
                              opacity: 0.3 + i * 0.1
                            }}
                          />
                        );
                      })}
                    </div>
                  </motion.div>

                  <motion.div
                    className="glass-panel rounded-xl p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Fan-out</span>
                      <span className="text-xs text-[var(--fg)]">Optimal</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {model.metrics.fanout}
                    </div>
                    <div className="mt-2 h-2 bg-[var(--panel-2)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[var(--ok)] to-[var(--accent)]"
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    className="glass-panel rounded-xl p-4"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Current Stage</span>
                      <span className="text-xs text-[var(--accent)]">● Active</span>
                    </div>
                    <div className="text-lg font-bold text-[var(--fg)] truncate">
                      {currentStage}
                    </div>
                    <div className="mt-2">
                      <div className="w-full h-2 bg-[var(--panel-2)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--ok)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${animationProgress}%` }}
                          transition={{ duration: 0.3, ease: 'linear' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>

          {/* Visualization Area with View Modes */}
          <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-[var(--panel)] via-transparent to-[var(--panel-2)]">
            <AnimatePresence mode="wait">
              {viewMode === 'single' && (
                <motion.div
                  key="single"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full p-6"
                >
                  <div className="h-full glass-panel rounded-2xl p-4 overflow-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">
                        {SOLUTIONS[state.solution]} Architecture
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted)]">Zoom</span>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-24"
                        />
                        <span className="text-sm">{Math.round(zoom * 100)}%</span>
                      </div>
                    </div>
                    
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                      <AnimatedSVGDiagram 
                        model={model} 
                        svgRef={svgRef} 
                        state={state} 
                        onTooltip={updateTooltip}
                        isPlaying={isPlaying}
                        onPlayComplete={() => setIsPlaying(false)}
                        playbackSpeed={playbackSpeed}
                        currentStage={currentStage}
                        setCurrentStage={setCurrentStage}
                        animationProgress={animationProgress}
                        setAnimationProgress={setAnimationProgress}
                      />
                    </div>
                  </div>
                  
                  {/* Minimap */}
                  {showMinimap && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute bottom-6 right-6 w-64 h-40 glass-panel rounded-xl p-2"
                    >
                      <div className="text-xs text-[var(--muted)] mb-1">Minimap</div>
                      <div className="w-full h-full bg-[var(--panel-2)] rounded-lg overflow-hidden opacity-50">
                        <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left' }}>
                          <SVGDiagram 
                            model={model} 
                            svgRef={dummyRef} 
                            onTooltip={() => {}}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {viewMode === 'compare' && (
                <motion.div
                  key="compare"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full p-6"
                >
                  <div className="h-full grid grid-cols-2 gap-4">
                    <div className="glass-panel rounded-2xl p-4 overflow-auto relative">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Left Panel</span>
                          <span className="text-xs px-2 py-1 bg-[var(--accent)] text-white rounded-full">Solution {state.solution.slice(1)}</span>
                        </div>
                        <select
                          value={state.solution}
                          onChange={(e) => setState({ ...state, solution: e.target.value as SolutionType })}
                          className="bg-[var(--panel-2)] text-[var(--fg)] px-3 py-2 rounded-lg w-full"
                        >
                          {Object.entries(SOLUTIONS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                        <div className="mt-2 text-sm">
                          <span className="text-[var(--accent)]">Latency: {model.metrics.latency}</span>
                          <span className="mx-2">•</span>
                          <span className="text-[var(--warn)]">Fan-out: {model.metrics.fanout}</span>
                        </div>
                      </div>
                      <AnimatedSVGDiagram 
                        model={model} 
                        svgRef={svgRef} 
                        state={state} 
                        onTooltip={updateTooltip}
                        isPlaying={isPlaying}
                        onPlayComplete={() => {}}
                        playbackSpeed={playbackSpeed}
                        currentStage={currentStage}
                        setCurrentStage={setCurrentStage}
                        animationProgress={animationProgress}
                        setAnimationProgress={setAnimationProgress}
                      />
                    </div>
                    
                    <div className="glass-panel rounded-2xl p-4 overflow-auto relative">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Right Panel</span>
                          <span className="text-xs px-2 py-1 bg-[var(--warn)] text-white rounded-full">Solution {compareSolution.slice(1)}</span>
                        </div>
                        <select
                          value={compareSolution}
                          onChange={(e) => setCompareSolution(e.target.value as SolutionType)}
                          className="bg-[var(--panel-2)] text-[var(--fg)] px-3 py-2 rounded-lg w-full"
                        >
                          {Object.entries(SOLUTIONS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                        <div className="mt-2 text-sm">
                          <span className="text-[var(--accent)]">Latency: {compareModel.metrics.latency}</span>
                          <span className="mx-2">•</span>
                          <span className="text-[var(--warn)]">Fan-out: {compareModel.metrics.fanout}</span>
                        </div>
                      </div>
                      <AnimatedSVGDiagram 
                        model={compareModel} 
                        svgRef={svgRef} 
                        state={compareState} 
                        onTooltip={updateTooltip}
                        isPlaying={isPlaying}
                        onPlayComplete={() => {}}
                        playbackSpeed={playbackSpeed}
                        currentStage={currentStage}
                        setCurrentStage={setCurrentStage}
                        animationProgress={animationProgress}
                        setAnimationProgress={setAnimationProgress}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {viewMode === 'timeline' && (
                <motion.div
                  key="timeline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full p-6"
                >
                  <div className="h-full glass-panel rounded-2xl p-6">
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold mb-4">Performance Timeline Analysis</h2>
                      <div className="flex gap-4">
                        {(['latency', 'throughput', 'cpu'] as const).map((metric) => (
                          <motion.button
                            key={metric}
                            onClick={() => setSelectedMetric(metric)}
                            className={`px-4 py-2 rounded-lg capitalize ${
                              selectedMetric === metric
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--panel-2)] text-[var(--muted)]'
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {metric}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="relative h-96 bg-[var(--panel-2)] rounded-xl p-6">
                      <svg className="w-full h-full">
                        {/* Grid lines */}
                        {[...Array(5)].map((_, i) => (
                          <g key={i}>
                            <line
                              x1="0"
                              x2="100%"
                              y1={`${i * 25}%`}
                              y2={`${i * 25}%`}
                              stroke="var(--grid)"
                              strokeDasharray="2 4"
                              opacity="0.3"
                            />
                            <text
                              x="0"
                              y={`${i * 25}%`}
                              fill="var(--muted)"
                              fontSize="10"
                              dy="-5"
                            >
                              {100 - i * 25}%
                            </text>
                          </g>
                        ))}

                        {/* Data lines for each solution */}
                        {['s1', 's2', 's3'].map((solution, idx) => {
                          const color = idx === 0 ? 'var(--ok)' : idx === 1 ? 'var(--warn)' : 'var(--accent)';
                          return (
                            <g key={solution}>
                              <polyline
                                points={performanceData
                                  .map((d, i) => {
                                    const value = selectedMetric === 'latency' ? d.latency :
                                                 selectedMetric === 'throughput' ? d.throughput : d.cpu;
                                    return `${(i / (performanceData.length - 1)) * 100}%,${100 - value}%`;
                                  })
                                  .join(' ')}
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                opacity="0.8"
                              />
                              {/* Data points */}
                              {performanceData.map((d, i) => {
                                const value = selectedMetric === 'latency' ? d.latency :
                                             selectedMetric === 'throughput' ? d.throughput : d.cpu;
                                return (
                                  <circle
                                    key={i}
                                    cx={`${(i / (performanceData.length - 1)) * 100}%`}
                                    cy={`${100 - value}%`}
                                    r="3"
                                    fill={color}
                                    className="pulse-animation"
                                  />
                                );
                              })}
                            </g>
                          );
                        })}

                        {/* Legend */}
                        <g transform="translate(20, 20)">
                          {['Serial', 'Parallel + Host', 'Parallel + SSD'].map((label, idx) => {
                            const color = idx === 0 ? 'var(--ok)' : idx === 1 ? 'var(--warn)' : 'var(--accent)';
                            return (
                              <g key={label} transform={`translate(${idx * 120}, 0)`}>
                                <rect x="0" y="0" width="12" height="12" fill={color} rx="2" />
                                <text x="16" y="9" fill="var(--fg)" fontSize="12">{label}</text>
                              </g>
                            );
                          })}
                        </g>
                      </svg>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <div className="bg-[var(--panel-2)] rounded-lg p-4">
                        <div className="text-xs text-[var(--muted)] uppercase mb-2">Best Latency</div>
                        <div className="text-xl font-bold text-[var(--ok)]">Solution 2</div>
                        <div className="text-sm text-[var(--muted)]">45µs average</div>
                      </div>
                      <div className="bg-[var(--panel-2)] rounded-lg p-4">
                        <div className="text-xs text-[var(--muted)] uppercase mb-2">Best Throughput</div>
                        <div className="text-xl font-bold text-[var(--warn)]">Solution 3</div>
                        <div className="text-sm text-[var(--muted)]">520 MB/s peak</div>
                      </div>
                      <div className="bg-[var(--panel-2)] rounded-lg p-4">
                        <div className="text-xs text-[var(--muted)] uppercase mb-2">Lowest CPU</div>
                        <div className="text-xl font-bold text-[var(--accent)]">Solution 3</div>
                        <div className="text-sm text-[var(--muted)]">18% average</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Enhanced Tooltip */}
      <AnimatePresence>
        {tooltip.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="glass-panel rounded-xl px-4 py-3 max-w-[320px] shadow-2xl">
              <div 
                className="text-sm leading-relaxed text-[#e8f0fa]"
                dangerouslySetInnerHTML={{ __html: tooltip.content }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}