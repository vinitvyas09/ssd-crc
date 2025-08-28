'use client';

import React, { useEffect, useState } from 'react';
import { WorkflowModel, WorkflowState, TooltipState } from '@/app/types/crc-workflow';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedSVGDiagramProps {
  model: WorkflowModel;
  svgRef: React.RefObject<SVGSVGElement | null>;
  state: WorkflowState;
  onTooltip: (e: React.MouseEvent, content: string) => void;
  isPlaying: boolean;
  onPlayComplete: () => void;
  playbackSpeed: number;
}

export default function AnimatedSVGDiagram({ 
  model, 
  svgRef, 
  state, 
  onTooltip, 
  isPlaying,
  onPlayComplete,
  playbackSpeed 
}: AnimatedSVGDiagramProps) {
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('Initializing');
  const [stageMinimized, setStageMinimized] = useState(false);
  
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

  // Animation logic
  useEffect(() => {
    if (!isPlaying) {
      setAnimationProgress(100);
      return;
    }

    const startTime = Date.now();
    const duration = 5000 / playbackSpeed; // Adjust duration based on playback speed

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setAnimationProgress(progress);
      
      if (progress < 100) {
        requestAnimationFrame(animate);
      } else {
        onPlayComplete();
      }
    };
    
    requestAnimationFrame(animate);
  }, [isPlaying, onPlayComplete, playbackSpeed]);

  const handleMouseEnter = (e: React.MouseEvent, content: string, id: string) => {
    onTooltip(e, content);
    setHoveredItem(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredItem) {
      onTooltip(e, '');
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  // Calculate visibility based on animation progress
  const getItemVisibility = (startTime: number, endTime: number) => {
    const itemProgress = (animationProgress / 100) * tmax;
    if (itemProgress < startTime) return 0;
    if (itemProgress >= endTime) return 1;
    return (itemProgress - startTime) / (endTime - startTime);
  };

  // Determine current stage based on animation progress
  useEffect(() => {
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
  }, [animationProgress, model, tmax]);

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
        
        {/* Gradient definitions for smooth transitions */}
        <linearGradient id="laneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Animated background grid */}
      <rect width={widthPx} height={gridH + topPad + bottomPad} fill="url(#laneGradient)" opacity="0.3" />

      {/* Lanes with left SSD/Host indicators */}
      {lanes.map((lane, i) => {
        const isSSD = lane.id.startsWith('ssd');
        const isHost = lane.id === 'host';
        return (
          <motion.g 
            key={lane.id} 
            transform={`translate(0,${topPad + i * laneH})`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            {/* Full lane background */}
            <rect 
              x="0" 
              y="0" 
              width={widthPx} 
              height={laneH} 
              fill="var(--lane)"
              style={{ opacity: hoveredItem === `lane-${i}` ? 0.85 : 1, transition: 'opacity 0.2s' }}
            />

            {/* Subtle lane tint to differentiate Host vs SSDs */}
            {isSSD && (
              <rect x="0" y="0" width={widthPx} height={laneH} fill="rgba(36,210,138,0.03)" />
            )}
            {isHost && (
              <rect x="0" y="0" width={widthPx} height={laneH} fill="rgba(89,168,255,0.03)" />
            )}

            {/* Left indicator column */}
            <rect x="0" y="0" width="150" height={laneH} fill={isHost ? 'rgba(89,168,255,0.06)' : 'rgba(36,210,138,0.06)'} />
            <line x1="150" x2="150" y1="0" y2={laneH} stroke="var(--grid)" strokeWidth="1" opacity="0.35" />

            {/* Icon + labels */}
            <g transform="translate(14, 22)">
              {isHost && (
                <text className="text-[18px]" fill="currentColor" style={{ color: 'var(--accent)' }} x="0" y="2">🖥️</text>
              )}
              {isSSD && (
                <text className="text-[18px]" fill="currentColor" style={{ color: 'var(--ok)' }} x="0" y="2">💾</text>
              )}
              <text x="30" y="0" className="text-[14px] font-semibold" fill="var(--fg)">{lane.label}</text>
              <text x="30" y="16" className="text-[11px]" fill="var(--muted)">{isHost ? 'Controller' : 'Storage Device'}</text>
            </g>

            {/* Lifelines */}
            <line
              x1={leftPad - 10}
              x2={widthPx - rightPad}
              y1={lifelineTop}
              y2={lifelineTop}
              stroke="var(--grid)"
              strokeDasharray="4 4"
              opacity="0.5"
            />
            <motion.line
              x1={leftPad}
              x2={leftPad}
              y1={lifelineTop}
              y2={lifelineBottom}
              stroke="var(--grid)"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: i * 0.1 }}
            />
          </motion.g>
        );
      })}

      {/* Activities with staggered animations */}
      <AnimatePresence>
        {model.activities.map((activity, idx) => {
          const laneIdx = laneIndex(activity.lane);
          const x = scaleX(activity.t0);
          const w = Math.max(1, scaleX(activity.t1) - scaleX(activity.t0));
          const y = topPad + laneIdx * laneH + 32;
          const h = 20;
          const visibility = getItemVisibility(activity.t0, activity.t1);

          return (
            <motion.g
              key={`activity-${idx}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: visibility,
                scale: 0.8 + (visibility * 0.2)
              }}
              onMouseEnter={(e) => handleMouseEnter(e, 
                `<strong>Activity</strong><br>${lanes[laneIdx].label}<br><code>${activity.label}</code><br>Duration: ${(activity.t1 - activity.t0).toFixed(1)} µs`,
                `activity-${idx}`
              )}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={w * visibility}
                height={h}
                rx="6"
                ry="6"
                fill="var(--activity)"
                stroke={hoveredItem === `activity-${idx}` ? 'var(--accent)' : '#2a3a4d'}
                strokeWidth={hoveredItem === `activity-${idx}` ? "2" : "1"}
                filter={hoveredItem === `activity-${idx}` ? 'url(#glow)' : ''}
              />
              {w > 60 && visibility > 0.5 && activity.label && (
                <text
                  x={x + 6}
                  y={y + 14}
                  className="text-xs font-medium"
                  fill="#cfe3ff"
                  opacity={visibility}
                >
                  {activity.label}
                </text>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Messages with animated paths */}
      <AnimatePresence>
        {model.events.map((event, idx) => {
          const fromIdx = laneIndex(event.from);
          const toIdx = laneIndex(event.to);
          const y1 = topPad + fromIdx * laneH + 42;
          const y2 = topPad + toIdx * laneH + 42;
          const x1 = scaleX(event.t0);
          const x2 = scaleX(event.t1);
          const visibility = getItemVisibility(event.t0, event.t1);
          
          const strokeColor = event.status === 'err' ? 'var(--err)' : 
                            event.status === 'warn' ? 'var(--warn)' : 'var(--ok)';
          const markerEnd = event.status === 'err' ? 'url(#arrowErr)' :
                           event.status === 'warn' ? 'url(#arrowWarn)' : 'url(#arrowOk)';

          // Calculate path for animation
          const currentX2 = x1 + (x2 - x1) * visibility;
          const currentY2 = y1 + (y2 - y1) * visibility;

          const hideInlineLabel = /CRC_Calc/.test(event.label);

          return (
            <motion.g
              key={`msg-${idx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: visibility > 0 ? 1 : 0 }}
              onMouseEnter={(e) => handleMouseEnter(e,
                `<strong>${event.label}</strong><br>${lanes[fromIdx].label} → ${lanes[toIdx].label}<br>Latency: ${(event.t1 - event.t0).toFixed(1)} µs`,
                `msg-${idx}`
              )}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer' }}
            >
              <motion.path
                d={`M ${x1} ${y1} L ${currentX2} ${currentY2}`}
                stroke={strokeColor}
                strokeWidth={hoveredItem === `msg-${idx}` ? "3" : "2"}
                fill="none"
                markerEnd={visibility > 0.9 ? markerEnd : ''}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: visibility }}
                transition={{ ease: "easeInOut" }}
                filter={hoveredItem === `msg-${idx}` ? 'url(#glow)' : ''}
              />
              {state.showLabels && visibility > 0.5 && !hideInlineLabel && (
                <motion.text
                  x={(x1 + currentX2) / 2}
                  y={(y1 + currentY2) / 2 - 6}
                  className="text-xs"
                  fill="currentColor" style={{ color: 'var(--fg)' }}
                  textAnchor="middle"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: visibility, y: 0 }}
                >
                  {event.label}
                </motion.text>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Notes with fade-in animation */}
      <AnimatePresence>
        {model.notes.map((note, idx) => {
          const laneIdx = laneIndex(note.lane);
          const x = scaleX(note.t) - 40;
          const y = topPad + laneIdx * laneH + 56;
          const w = 260;
          const h = 18;
          const visibility = getItemVisibility(note.t - 5, note.t);

          return (
            <motion.g
              key={`note-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: visibility, y: 0 }}
              onMouseEnter={(e) => handleMouseEnter(e,
                `<strong>Note</strong><br>${lanes[laneIdx].label}<br>${note.label}`,
                `note-${idx}`
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
                stroke={hoveredItem === `note-${idx}` ? 'var(--accent)' : '#2a3a4d'}
                strokeWidth="1"
                opacity={visibility * 0.9}
              />
              <text x={x + 8} y={y + 13} className="text-xs" fill="var(--fg)" opacity={visibility}>
                {note.label}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Progress indicator */}
      {isPlaying && (
        <motion.rect
          x={scaleX((animationProgress / 100) * tmax) - 1}
          y={topPad}
          width="2"
          height={gridH - 20}
          fill="var(--accent)"
          opacity="0.6"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}

      {/* Stage indicator (bottom-right), minimizable */}
      <motion.g
        transform={`translate(${20}, ${gridH + topPad + bottomPad - 60})`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <rect
          x="0"
          y={stageMinimized ? '40' : '0'}
          width="260"
          height={stageMinimized ? '20' : '50'}
          rx="8"
          fill="rgba(0,0,0,0.75)"
          stroke="var(--accent)"
          strokeWidth="1"
          opacity="0.9"
          style={{ cursor: 'pointer' }}
          onClick={() => setStageMinimized(!stageMinimized)}
        />
        <text
          x="240"
          y={stageMinimized ? '54' : '18'}
          className="text-[12px]"
          fill="currentColor" style={{ color: 'var(--muted)', cursor: 'pointer' }}
          onClick={() => setStageMinimized(!stageMinimized)}
        >
          {stageMinimized ? '▲' : '▼'}
        </text>
        {!stageMinimized && (
          <>
            <text x="10" y="18" className="text-[11px] font-semibold" fill="currentColor" style={{ color: 'var(--muted)' }}>CURRENT STAGE</text>
            <text x="10" y="36" className="text-[14px] font-medium" fill="currentColor" style={{ color: 'var(--fg)' }}>{currentStage}</text>
            <rect x="10" y="42" width="220" height="3" rx="1.5" fill="currentColor" style={{ fill: 'var(--grid)' }} />
            <motion.rect
              x="10" y="42" height="3" rx="1.5" fill="var(--accent)"
              initial={{ width: 0 }}
              animate={{ width: 220 * (animationProgress / 100) }}
            />
          </>
        )}
        {stageMinimized && (
          <text x="10" y="54" className="text-[12px]" fill="currentColor" style={{ color: 'var(--fg)' }}>{currentStage}</text>
        )}
      </motion.g>
    </svg>
  );
}