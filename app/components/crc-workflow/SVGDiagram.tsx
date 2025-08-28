'use client';

import React from 'react';
import { WorkflowModel, WorkflowState, TooltipState } from '@/app/types/crc-workflow';

interface SVGDiagramProps {
  model: WorkflowModel;
  svgRef: React.RefObject<SVGSVGElement | null> | null;
  state: WorkflowState;
  onTooltip: (tooltip: TooltipState) => void;
}

export default function SVGDiagram({ model, svgRef, state, onTooltip }: SVGDiagramProps) {
  const lanes = model.participants;
  const laneH = 70;
  const lifelineTop = 26;
  const lifelineBottom = laneH - 14;
  const gridH = lanes.length * laneH + 20;
  const leftPad = 160;
  const rightPad = 24;
  const topPad = 16;
  const bottomPad = 24;
  const widthPx = 1400;
  const tmax = model.tmax || 100;
  
  const scaleX = (t: number) => leftPad + (t / tmax) * (widthPx - leftPad - rightPad);
  const laneIndex = (id: string) => Math.max(0, lanes.findIndex(l => l.id === id));

  const [currentContent, setCurrentContent] = React.useState('');

  const handleMouseEnter = (e: React.MouseEvent, content: string) => {
    setCurrentContent(content);
    onTooltip({
      visible: true,
      x: e.clientX + 12,
      y: e.clientY - 12,
      content
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    onTooltip({
      visible: true,
      x: e.clientX + 12,
      y: e.clientY - 12,
      content: currentContent
    });
  };

  const handleMouseLeave = () => {
    onTooltip({ visible: false, x: 0, y: 0, content: '' });
  };

  return (
    <svg
      ref={svgRef}
      width={widthPx}
      height={gridH + topPad + bottomPad}
      viewBox={`0 0 ${widthPx} ${gridH + topPad + bottomPad}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="arrowOk"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 4 L 0 8 z" fill="#24d28a" />
        </marker>
        <marker
          id="arrowErr"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 4 L 0 8 z" fill="#ff6b6b" />
        </marker>
        <marker
          id="arrowWarn"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 4 L 0 8 z" fill="#ffcc40" />
        </marker>
      </defs>

      {/* Background lanes with left indicator column */}
      {lanes.map((lane, i) => {
        const isSSD = lane.id.startsWith('ssd');
        const isHost = lane.id === 'host';
        return (
          <g key={lane.id} transform={`translate(0,${topPad + i * laneH})`}>
            <rect x="0" y="0" width={widthPx} height={laneH} fill="var(--lane)" />
            {/* Left indicator */}
            <rect x="0" y="0" width="150" height={laneH} fill={isHost ? 'rgba(89,168,255,0.06)' : 'rgba(36,210,138,0.06)'} />
            <line x1="150" x2="150" y1="0" y2={laneH} stroke="#2b3a4a" opacity="0.35" />
            {/* Icon and labels */}
            <g transform="translate(14, 22)">
              {isHost && (<text className="text-[18px]" fill="currentColor" style={{ color: 'var(--accent)' }} x="0" y="2">🖥️</text>)}
              {isSSD && (<text className="text-[18px]" fill="currentColor" style={{ color: 'var(--ok)' }} x="0" y="2">💾</text>)}
              <text x="30" y="0" className="text-[14px] font-semibold" fill="var(--fg)">{lane.label}</text>
              <text x="30" y="16" className="text-[11px]" fill="var(--muted)">{isHost ? 'Controller' : 'Storage Device'}</text>
            </g>
            <line
              x1={leftPad - 10}
              x2={widthPx - rightPad}
              y1={lifelineTop}
              y2={lifelineTop}
              stroke="#1c2835"
              strokeDasharray="4 4"
            />
            <line
              x1={leftPad}
              x2={leftPad}
              y1={lifelineTop}
              y2={lifelineBottom}
              stroke="#2b3a4a"
              strokeDasharray="4 4"
            />
          </g>
        );
      })}

      {/* Activities */}
      {model.activities.map((activity, idx) => {
        const laneIdx = laneIndex(activity.lane);
        const x = scaleX(activity.t0);
        const w = Math.max(1, scaleX(activity.t1) - scaleX(activity.t0));
        const y = topPad + laneIdx * laneH + 32;
        const h = 20;

        return (
          <g
            key={`activity-${idx}`}
            onMouseEnter={(e) => handleMouseEnter(e, 
              `<strong>Activity</strong><br>${lanes[laneIdx].label}<br><code>${activity.label}</code><br>t=[${activity.t0.toFixed(1)}, ${activity.t1.toFixed(1)}] µs`
            )}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx="6"
              ry="6"
              fill="var(--activity)"
              stroke="#2a3a4d"
              strokeWidth="1"
            />
            {w > 60 && activity.label && (
              <text
                x={x + 6}
                y={y + 14}
                className="text-xs font-medium"
                fill="#cfe3ff"
              >
                {activity.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Messages */}
      {model.events.map((event, idx) => {
        const fromIdx = laneIndex(event.from);
        const toIdx = laneIndex(event.to);
        const y1 = topPad + fromIdx * laneH + 42;
        const y2 = topPad + toIdx * laneH + 42;
        const x1 = scaleX(event.t0);
        const x2 = scaleX(event.t1);
        
        const strokeColor = event.status === 'err' ? 'var(--err)' : 
                          event.status === 'warn' ? 'var(--warn)' : 'var(--ok)';
        const markerEnd = event.status === 'err' ? 'url(#arrowErr)' :
                         event.status === 'warn' ? 'url(#arrowWarn)' : 'url(#arrowOk)';

        return (
          <g
            key={`msg-${idx}`}
            onMouseEnter={(e) => handleMouseEnter(e,
              `<strong>Message</strong><br>${lanes[fromIdx].label} ➜ ${lanes[toIdx].label}<br><code>${event.label}</code><br>t=[${event.t0.toFixed(1)}, ${event.t1.toFixed(1)}] µs`
            )}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <path
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={strokeColor}
              strokeWidth="2"
              fill="none"
              markerEnd={markerEnd}
            />
            {/* Intentionally hide inline event labels to avoid visual overlap with arrows.
                Detailed content remains accessible via tooltip on hover. */}
          </g>
        );
      })}

      {/* Notes */}
      {model.notes.map((note, idx) => {
        const laneIdx = laneIndex(note.lane);
        const x = scaleX(note.t) - 40;
        const y = topPad + laneIdx * laneH + 56;
        const w = 260;
        const h = 18;

        return (
          <g
            key={`note-${idx}`}
            onMouseEnter={(e) => handleMouseEnter(e,
              `<strong>Note</strong><br>${lanes[laneIdx].label}<br>${note.label}<br>t≈${note.t.toFixed(1)} µs`
            )}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx="6"
              ry="6"
              fill="var(--note)"
              stroke="#2a3a4d"
              strokeWidth="1"
            />
            <text x={x + 8} y={y + 13} className="text-xs" fill="var(--fg)">
              {note.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}