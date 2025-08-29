'use client';

import React, { useState } from 'react';
import { WorkflowModel, WorkflowState } from '@/app/types/crc-workflow';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedSVGDiagramProps {
  model: WorkflowModel;
  svgRef: React.RefObject<SVGSVGElement | null>;
  state: WorkflowState;
  onTooltip: (e: React.MouseEvent, content: string) => void;
  onHideTooltip?: () => void;
  isPlaying: boolean;
  onPlayComplete: () => void;
  playbackSpeed: number;
  currentStage: string;
  setCurrentStage: (stage: string) => void;
  animationProgress: number;
  setAnimationProgress: (progress: number) => void;
}

export default function AnimatedSVGDiagram({ 
  model, 
  svgRef, 
  state, 
  onTooltip, 
  onHideTooltip,
  isPlaying,
  animationProgress
}: AnimatedSVGDiagramProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  const lanes = model.participants;
  const laneH = 70;
  const lifelineTop = 26;
  const lifelineBottom = laneH - 14;
  const gridH = lanes.length * laneH + 20;
  const leftPad = 160;
  const rightPad = 200;  // Increased from 24 to 200 for better visual padding
  const topPad = 16;
  const bottomPad = 24;
  const widthPx = 1400;
  const tmax = model.tmax || 100;
  
  const scaleX = (t: number) => leftPad + (t / tmax) * (widthPx - leftPad - rightPad);
  const laneIndex = (id: string) => Math.max(0, lanes.findIndex(l => l.id === id));

  // Animation logic moved to parent component

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
    if (onHideTooltip) onHideTooltip();
  };

  // Calculate visibility based on animation progress
  const getItemVisibility = (startTime: number, endTime: number) => {
    const itemProgress = (animationProgress / 100) * tmax;
    if (itemProgress < startTime) return 0;
    if (itemProgress >= endTime) return 1;
    return (itemProgress - startTime) / (endTime - startTime);
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
          <path d="M 0 0 L 10 4 L 0 8 z" fill="#5eb3d6" />
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
        
        {/* Animated gradient for CRC compute activities - more subtle */}
        <linearGradient id="crcComputeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <animate attributeName="x1" values="0%;100%;0%" dur="3s" repeatCount="indefinite" />
          <stop offset="0%" stopColor="#5eb3d6">
            <animate attributeName="stop-color" values="#5eb3d6;#4a9bc2;#5eb3d6" dur="3s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor="#4288b5">
            <animate attributeName="stop-color" values="#4288b5;#5eb3d6;#4288b5" dur="3s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#6b7cb8">
            <animate attributeName="stop-color" values="#6b7cb8;#4288b5;#6b7cb8" dur="3s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        
        {/* Host aggregation gradient - more subtle */}
        <linearGradient id="hostAggGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <animate attributeName="x1" values="0%;50%;0%" dur="4s" repeatCount="indefinite" />
          <stop offset="0%" stopColor="#6b95c7">
            <animate attributeName="stop-color" values="#6b95c7;#7da3d1;#6b95c7" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#4eb89a">
            <animate attributeName="stop-color" values="#4eb89a;#5cc2a6;#4eb89a" dur="2s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        
        {/* SSD aggregation gradient - more subtle */}
        <linearGradient id="ssdAggGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <animate attributeName="x2" values="100%;200%;100%" dur="3s" repeatCount="indefinite" />
          <stop offset="0%" stopColor="#4eb89a" />
          <stop offset="50%" stopColor="#52c2a1">
            <animate attributeName="offset" values="50%;70%;50%" dur="3s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#6bd1ab" />
        </linearGradient>
        
        {/* Enhanced glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Pulse glow for active compute */}
        <filter id="pulseGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur">
            <animate attributeName="stdDeviation" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
          </feGaussianBlur>
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
            initial={{ opacity: 0, x: -20, y: topPad + i * laneH }}
            animate={{ opacity: 1, x: 0, y: topPad + i * laneH }}
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

            {/* Subtle lane tint to differentiate Host vs SSDs with gradient */}
            {isSSD && (
              <>
                <defs>
                  <linearGradient id={`ssdLaneGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(36,210,138,0.08)" />
                    <stop offset="50%" stopColor="rgba(36,210,138,0.03)" />
                    <stop offset="100%" stopColor="rgba(36,210,138,0.01)" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width={widthPx} height={laneH} fill={`url(#ssdLaneGrad-${i})`} />
              </>
            )}
            {isHost && (
              <>
                <defs>
                  <linearGradient id="hostLaneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(89,168,255,0.08)" />
                    <stop offset="50%" stopColor="rgba(89,168,255,0.03)" />
                    <stop offset="100%" stopColor="rgba(89,168,255,0.01)" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width={widthPx} height={laneH} fill="url(#hostLaneGrad)" />
              </>
            )}

            {/* Left indicator column with gradient background */}
            <defs>
              <linearGradient id={`indicatorGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isHost ? '#2a3f5f' : '#1a3d3a'} />
                <stop offset="90%" stopColor={isHost ? '#1e2d42' : '#162a28'} />
                <stop offset="100%" stopColor="#1a1f2e" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="150" height={laneH} fill={`url(#indicatorGrad-${i})`} />
            <rect x="0" y="0" width="150" height={laneH} fill={isHost ? 'rgba(89,168,255,0.15)' : 'rgba(36,210,138,0.15)'} />
            <rect x="0" y="0" width="4" height={laneH} fill={isHost ? '#59a8ff' : '#24d28a'}>
              <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
            </rect>
            <line x1="150" x2="150" y1="0" y2={laneH} stroke={isHost ? '#59a8ff' : '#24d28a'} strokeWidth="1" opacity="0.3" />

            {/* Icon + labels */}
            <g transform="translate(14, 35)">
              {isHost && (
                <text fontSize="20" x="0" y="0">🖥️</text>
              )}
              {isSSD && (
                <text fontSize="20" x="0" y="0">💾</text>
              )}
              <text x="32" y="-2" fontSize="15" fontWeight="bold" fill="#ffffff">{lane.label}</text>
              <text x="32" y="16" fontSize="12" fill="#9ca3af">{isHost ? 'Controller' : 'Storage Device'}</text>
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
          const h = 24;
          const visibility = getItemVisibility(activity.t0, activity.t1);
          
          // Determine gradient and styling based on activity type
          const isCRCCompute = activity.label?.includes('CRC compute');
          const isHostAgg = activity.lane === 'host' && !activity.label?.includes('Note');
          const isSSDAggregate = activity.label?.includes('Aggregate');
          const isActive = visibility > 0 && visibility < 1;
          
          let fillColor = "var(--activity)";
          let strokeColor = '#2a3a4d';
          let filterEffect = '';
          let textColor = "#cfe3ff";
          
          if (isCRCCompute) {
            fillColor = isActive ? "url(#crcComputeGradient)" : "#4288b5";
            strokeColor = isActive ? '#5eb3d6' : '#4a9bc2';
            filterEffect = isActive ? 'url(#pulseGlow)' : '';
            textColor = "#ffffff";
          } else if (isHostAgg) {
            fillColor = isActive ? "url(#hostAggGradient)" : "#6b95c7";
            strokeColor = isActive ? '#7da3d1' : '#6b95c7';
            filterEffect = isActive ? 'url(#glow)' : '';
            textColor = "#ffffff";
          } else if (isSSDAggregate) {
            fillColor = isActive ? "url(#ssdAggGradient)" : "#4eb89a";
            strokeColor = isActive ? '#5cc2a6' : '#4eb89a';
            filterEffect = isActive ? 'url(#pulseGlow)' : '';
            textColor = "#ffffff";
          }
          
          if (hoveredItem === `activity-${idx}`) {
            strokeColor = 'var(--accent)';
            filterEffect = 'url(#glow)';
          }

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
              {/* Shadow/glow background for active compute */}
              {isActive && (isCRCCompute || isSSDAggregate) && (
                <motion.rect
                  x={x - 2}
                  y={y - 2}
                  width={(w * visibility) + 4}
                  height={h + 4}
                  rx="8"
                  ry="8"
                  fill="none"
                  stroke={isCRCCompute ? "#5eb3d6" : "#4eb89a"}
                  strokeWidth="1"
                  opacity="0.3"
                  animate={{ 
                    opacity: [0.2, 0.5, 0.2],
                    strokeWidth: [1, 2, 1]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              
              <rect
                x={x}
                y={y}
                width={w * visibility}
                height={h}
                rx="8"
                ry="8"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={hoveredItem === `activity-${idx}` ? "2" : "1.5"}
                filter={filterEffect}
                opacity={isActive ? 1 : 0.9}
              />
              
              {w > 40 && visibility > 0.5 && activity.label && (
                <g>
                  <clipPath id={`clip-activity-${idx}`}>
                    <rect x={x + 4} y={y} width={Math.max(0, (w * visibility) - 8)} height={h} />
                  </clipPath>
                  <text
                    x={x + 8}
                    y={y + 15}
                    className="text-xs font-medium"
                    fill={textColor}
                    opacity={visibility}
                    clipPath={`url(#clip-activity-${idx})`}
                    style={{ 
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      pointerEvents: 'none'
                    }}
                  >
                    {activity.label}
                  </text>
                </g>
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
          
          const strokeColor = event.status === 'err' ? '#ff6b6b' : 
                            event.status === 'warn' ? '#ffcc40' : '#5eb3d6';
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
              <g>
                <clipPath id={`clip-note-${idx}`}>
                  <rect x={x + 4} y={y} width={w - 8} height={h} />
                </clipPath>
                <text 
                  x={x + 8} 
                  y={y + 13} 
                  className="text-xs" 
                  fill="var(--fg)" 
                  opacity={visibility}
                  clipPath={`url(#clip-note-${idx})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {note.label}
                </text>
              </g>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Progress indicator */}
      {isPlaying && (
        <>
          {/* Glow effect for progress line */}
          <motion.rect
            x={scaleX((animationProgress / 100) * tmax) - 3}
            y={topPad}
            width="6"
            height={gridH - 20}
            fill="url(#crcComputeGradient)"
            opacity="0.2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 1, repeat: Infinity }}
            filter="url(#glow)"
          />
          <motion.rect
            x={scaleX((animationProgress / 100) * tmax) - 1}
            y={topPad}
            width="2"
            height={gridH - 20}
            fill="#5eb3d6"
            opacity="0.9"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </>
      )}

    </svg>
  );
}