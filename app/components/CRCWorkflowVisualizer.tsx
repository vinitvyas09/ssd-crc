'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WorkflowState, TooltipState, initialState } from '@/app/types/crc-workflow';
import { buildWorkflowModel } from '@/app/utils/workflow-model-builder';
import ControlPanel from '@/app/components/crc-workflow/ControlPanel';
import SVGDiagram from '@/app/components/crc-workflow/SVGDiagram';

// Main Component
export default function CRCWorkflowVisualizer() {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: '' });
  
  const svgRef = useRef<SVGSVGElement>(null);

  // Apply dark/light mode to CSS variables
  useEffect(() => {
    const root = document.documentElement;
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
    }
  }, [state.dark]);

  // Build the workflow model
  const model = useMemo(() => buildWorkflowModel(state), [state]);

  // Export functions
  const exportSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crc_workflow_${state.solution}.svg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  };

  const exportPNG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
    
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const rect = svgRef.current!.getBoundingClientRect();
      canvas.width = svgRef.current!.viewBox?.baseVal.width || rect.width;
      canvas.height = svgRef.current!.viewBox?.baseVal.height || rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#0b0f14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(blob => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `crc_workflow_${state.solution}.png`;
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
  };

  const handleReset = () => {
    setState(initialState);
  };

  return (
    <div className="crc-workflow-container">
      <style jsx global>{`
        :root {
          --bg: #0b0f14;
          --panel: #111821;
          --panel-2: #0e141b;
          --fg: #e6eef7;
          --muted: #9fb0c4;
          --accent: #59a8ff;
          --ok: #24d28a;
          --warn: #ffcc40;
          --err: #ff6b6b;
          --grid: #233040;
          --lane: #1a2532;
          --note: #2b3b51;
          --activity: #1e2a39;
          --shadow: rgba(0,0,0,0.25);
        }
        
        .crc-workflow-container {
          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--grid)] bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-transparent">
        <div>
          <h1 className="text-base font-semibold m-0 tracking-[0.2px]">
            CRC validation workflows — interactive swimlane sequence
          </h1>
          <div className="text-[var(--muted)] text-xs mt-1">
            Serial (seeded) vs Parallel + Host aggregation vs Parallel + SSD aggregation
          </div>
        </div>
        <div className="flex items-center gap-2 px-[10px] py-[6px] bg-[var(--panel)] border border-[var(--grid)] rounded-lg">
          <button
            onClick={exportSVG}
            className="px-[10px] py-[8px] bg-[var(--panel-2)] text-[var(--fg)] border border-[var(--grid)] rounded-lg text-[13px] cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            Export SVG
          </button>
          <button
            onClick={exportPNG}
            className="px-[10px] py-[8px] bg-[var(--panel-2)] text-[var(--fg)] border border-[var(--grid)] rounded-lg text-[13px] cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            Export PNG
          </button>
          <button
            onClick={handleReset}
            className="px-[10px] py-[8px] bg-[var(--panel-2)] text-[var(--fg)] border border-[var(--grid)] rounded-lg text-[13px] cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid grid-cols-[320px_1fr] gap-4 p-[14px]">
        {/* Controls Panel */}
        <ControlPanel state={state} setState={setState} />

        {/* Canvas Panel */}
        <div className="bg-[var(--panel)] border border-[var(--grid)] rounded-[10px] shadow-[0_4px_14px_var(--shadow)]">
          <div className="p-3 overflow-auto">
            <div className="bg-gradient-to-b from-[rgba(255,255,255,0.02)] to-transparent rounded-[10px] border border-[var(--grid)]">
              <SVGDiagram model={model} svgRef={svgRef} state={state} onTooltip={setTooltip} />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-[10px] p-[10px_14px] border-t border-dashed border-[var(--grid)]">
            <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-[10px] py-2 text-xs text-[var(--muted)]">
              <strong className="text-[var(--fg)] text-[13px]">Critical path latency</strong><br />
              <span>{model.metrics.latency}</span>
            </div>
            <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-[10px] py-2 text-xs text-[var(--muted)]">
              <strong className="text-[var(--fg)] text-[13px]">In-flight fan-out</strong><br />
              <span>{model.metrics.fanout}</span>
            </div>
            <div className="bg-[var(--panel-2)] border border-[var(--grid)] rounded-lg px-[10px] py-2 text-xs text-[var(--muted)]">
              <strong className="text-[var(--fg)] text-[13px]">Notes</strong><br />
              <span>{model.metrics.notes}</span>
            </div>
          </div>
          
          <footer className="px-[14px] py-[10px] text-[var(--muted)] text-xs">
            Tip: hover on arrows/activities for detail. Export the drawing to SVG/PNG using the buttons above.
          </footer>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed pointer-events-none bg-[#0e1217] border border-[#263241] text-[#e8f0fa] rounded-lg px-[10px] py-2 text-xs shadow-[0_10px_24px_rgba(0,0,0,0.35)] z-[9999] max-w-[320px] leading-[1.35]"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -120%)'
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
}