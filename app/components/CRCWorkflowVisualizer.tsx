'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { WorkflowState, TooltipState, initialState } from '@/app/types/crc-workflow';
import { buildWorkflowModel } from '@/app/utils/workflow-model-builder';
import ControlPanel from '@/app/components/crc-workflow/ControlPanel';
import AnimatedSVGDiagram from '@/app/components/crc-workflow/AnimatedSVGDiagram';
import { motion, AnimatePresence } from 'framer-motion';

export default function CRCWorkflowVisualizer() {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply dark/light mode with smooth transitions
  useEffect(() => {
    const root = document.documentElement;
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    if (state.dark) {
      root.style.setProperty('--bg', '#0b0f14');
      root.style.setProperty('--panel', '#111821');
      root.style.setProperty('--panel-2', '#0e141b');
      root.style.setProperty('--fg', '#e6eef7');
      root.style.setProperty('--muted', '#9fb0c4');
      root.style.setProperty('--grid', '#233040');
      root.style.setProperty('--lane', '#1a2532');
      root.style.setProperty('--note', '#2b3b51');
      root.style.setProperty('--activity', '#1e2a39');
      root.style.setProperty('--accent-hover', '#70b4ff');
    } else {
      root.style.setProperty('--bg', '#f7fbff');
      root.style.setProperty('--panel', '#ffffff');
      root.style.setProperty('--panel-2', '#f4f7fb');
      root.style.setProperty('--fg', '#0b1522');
      root.style.setProperty('--muted', '#506070');
      root.style.setProperty('--grid', '#d8e1ec');
      root.style.setProperty('--lane', '#eef4fb');
      root.style.setProperty('--note', '#e6eef7');
      root.style.setProperty('--activity', '#eaf1f9');
      root.style.setProperty('--accent-hover', '#3d94ff');
    }
  }, [state.dark]);

  // Build the workflow model with memoization
  const model = useMemo(() => buildWorkflowModel(state), [state]);

  // Smart tooltip positioning to avoid edges
  const updateTooltip = useCallback((e: React.MouseEvent, content: string) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY - 40;

    // Prevent tooltip from going off screen
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

  // Export functions with improved feedback
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
      const scale = 2; // For higher quality
      canvas.width = (svgRef.current!.viewBox?.baseVal.width || rect.width) * scale;
      canvas.height = (svgRef.current!.viewBox?.baseVal.height || rect.height) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.scale(scale, scale);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#0b0f14';
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
  }, []);

  return (
    <div className="crc-workflow-container" ref={containerRef}>
      <style jsx global>{`
        :root {
          --bg: #0b0f14;
          --panel: #111821;
          --panel-2: #0e141b;
          --fg: #e6eef7;
          --muted: #9fb0c4;
          --accent: #59a8ff;
          --accent-hover: #70b4ff;
          --ok: #24d28a;
          --warn: #ffcc40;
          --err: #ff6b6b;
          --grid: #233040;
          --lane: #1a2532;
          --note: #2b3b51;
          --activity: #1e2a39;
          --shadow: rgba(0,0,0,0.25);
        }
        
        * {
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        
        .crc-workflow-container {
          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          transition: all 0.2s ease;
          transform: translateY(0);
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(89, 168, 255, 0.3);
        }
        
        .btn-secondary {
          background: var(--panel-2);
          border: 1px solid var(--grid);
          color: var(--fg);
          transition: all 0.2s ease;
        }
        
        .btn-secondary:hover {
          border-color: var(--accent);
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
        }
        
        .metric-card {
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
          border: 1px solid var(--grid);
          transition: all 0.2s ease;
        }
        
        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}</style>

      {/* Header with smooth animations */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-4 border-b border-[var(--grid)] bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-transparent backdrop-blur-sm"
      >
        <div>
          <h1 className="text-xl font-semibold m-0 tracking-tight">
            CRC Validation Workflows
          </h1>
          <div className="text-[var(--muted)] text-sm mt-1">
            Interactive visualization of computational storage architectures
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Animation'}
          </motion.button>
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--panel)] border border-[var(--grid)] rounded-lg backdrop-blur-sm">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportSVG}
              className="btn-secondary px-3 py-2 rounded-md text-sm cursor-pointer"
            >
              📥 SVG
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportPNG}
              className="btn-secondary px-3 py-2 rounded-md text-sm cursor-pointer"
            >
              📥 PNG
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReset}
              className="btn-secondary px-3 py-2 rounded-md text-sm cursor-pointer"
            >
              🔄 Reset
            </motion.button>
          </div>
        </div>
      </motion.header>

      <div className="flex gap-4 p-4">
        {/* Controls Panel with animations */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ControlPanel state={state} setState={setState} />
        </motion.div>

        {/* Canvas Panel with smooth transitions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-[var(--panel)] border border-[var(--grid)] rounded-xl shadow-xl overflow-hidden"
        >
          <div className="p-4 overflow-auto">
            <div className="bg-gradient-to-b from-[rgba(255,255,255,0.02)] to-transparent rounded-xl border border-[var(--grid)]">
              <AnimatedSVGDiagram 
                model={model} 
                svgRef={svgRef} 
                state={state} 
                onTooltip={updateTooltip}
                isPlaying={isPlaying}
                onPlayComplete={() => setIsPlaying(false)}
              />
            </div>
          </div>
          
          {/* Metrics with hover effects */}
          <div className="grid grid-cols-3 gap-4 p-4 border-t border-dashed border-[var(--grid)]">
            <motion.div 
              whileHover={{ y: -2 }}
              className="metric-card rounded-lg px-4 py-3"
            >
              <div className="text-[var(--accent)] text-xs font-semibold uppercase tracking-wider">Latency</div>
              <div className="text-lg font-bold mt-1">{model.metrics.latency}</div>
            </motion.div>
            <motion.div 
              whileHover={{ y: -2 }}
              className="metric-card rounded-lg px-4 py-3"
            >
              <div className="text-[var(--warn)] text-xs font-semibold uppercase tracking-wider">Fan-out</div>
              <div className="text-lg font-bold mt-1">{model.metrics.fanout}</div>
            </motion.div>
            <motion.div 
              whileHover={{ y: -2 }}
              className="metric-card rounded-lg px-4 py-3"
            >
              <div className="text-[var(--ok)] text-xs font-semibold uppercase tracking-wider">Architecture</div>
              <div className="text-sm mt-1">{model.metrics.notes}</div>
            </motion.div>
          </div>
          
          <footer className="px-4 py-3 text-[var(--muted)] text-xs bg-gradient-to-t from-[rgba(0,0,0,0.1)] to-transparent">
            💡 Hover over elements for details • Click play to animate the workflow
          </footer>
        </motion.div>
      </div>

      {/* Improved Tooltip with animations */}
      <AnimatePresence>
        {tooltip.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed pointer-events-none bg-[#0e1217] border border-[#263241] text-[#e8f0fa] rounded-xl px-4 py-3 text-sm shadow-2xl z-[9999] max-w-[320px] leading-relaxed backdrop-blur-md"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translate(-50%, -100%)',
              background: 'linear-gradient(135deg, rgba(14,18,23,0.98), rgba(17,24,33,0.98))'
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}