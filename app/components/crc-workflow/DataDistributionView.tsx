'use client';

import React, { useMemo } from 'react';
import { WorkflowState } from '@/app/types/crc-workflow';

interface DataDistributionViewProps {
  state: WorkflowState;
}

export default function DataDistributionView({ state }: DataDistributionViewProps) {
  const { objectSizeGB, shardSizeGB, chunkBytes, W } = state;
  
  const calculations = useMemo(() => {
    const totalShards = Math.ceil(objectSizeGB / shardSizeGB);
    const bytesPerShard = shardSizeGB * 1024 * 1024 * 1024;
    const chunksPerShard = Math.ceil(bytesPerShard / chunkBytes);
    const totalChunks = totalShards * chunksPerShard;
    const chunkSizeMB = chunkBytes / (1024 * 1024);
    
    // Distribute shards evenly across SSDs using round-robin
    const shardDistribution: number[][] = Array.from({ length: W }, () => []);
    for (let i = 0; i < totalShards; i++) {
      shardDistribution[i % W].push(i);
    }
    
    return {
      totalShards,
      chunksPerShard,
      totalChunks,
      chunkSizeMB,
      bytesPerShard,
      shardDistribution
    };
  }, [objectSizeGB, shardSizeGB, chunkBytes, W]);

  // Use accent colors consistent with the theme
  const ssdColors = useMemo(() => {
    // Generate colors based on the accent color
    const baseHue = 210; // Blue base
    return Array.from({ length: 12 }, (_, i) => {
      const hue = (baseHue + (i * 30)) % 360;
      return `hsl(${hue}, 70%, ${state.dark ? '60%' : '50%'})`;
    });
  }, [state.dark]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Statistics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--panel-2)' }}>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Total Object Size</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{objectSizeGB} GB</div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--panel-2)' }}>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Total Shards</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{calculations.totalShards}</div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--panel-2)' }}>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Chunks per Shard</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{calculations.chunksPerShard.toLocaleString()}</div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--panel-2)' }}>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Total CRC Commands</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{calculations.totalChunks.toLocaleString()}</div>
        </div>
      </div>

      {/* Object to Shards Breakdown */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--panel)', boxShadow: '0 1px 3px var(--shadow)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>Object → Shards Distribution</h3>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <div className="rounded-lg p-4 text-white" style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-hover))` }}>
              <div className="text-sm opacity-90">Host Object</div>
              <div className="text-3xl font-bold">{objectSizeGB} GB</div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <svg width="100" height="50" style={{ color: 'var(--muted)' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
                  <polygon points="0 0, 10 5, 0 10" fill="currentColor" />
                </marker>
              </defs>
              <path d="M 10 25 L 90 25" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrowhead)" />
            </svg>
          </div>
          
          <div className="flex-1">
            <div className="flex flex-wrap gap-1 justify-end">
              {(() => {
                const maxVisibleShards = 15;
                const shardViews = [];
                
                if (calculations.totalShards <= maxVisibleShards) {
                  // Show all shards
                  for (let i = 0; i < calculations.totalShards; i++) {
                    shardViews.push(
                      <div 
                        key={i} 
                        className="rounded px-2 py-1 text-center"
                        style={{ 
                          backgroundColor: 'var(--activity)',
                          color: 'var(--fg)',
                          border: '1px solid var(--grid)',
                          minWidth: `${Math.max(40, 100 / Math.sqrt(calculations.totalShards))}px`,
                          fontSize: `${Math.max(10, 14 - calculations.totalShards / 5)}px`
                        }}
                      >
                        <div className="text-xs opacity-75">S{i + 1}</div>
                        <div className="font-semibold">{shardSizeGB}GB</div>
                      </div>
                    );
                  }
                } else {
                  // Show first 13, ellipsis, then last shard
                  for (let i = 0; i < 13; i++) {
                    const scale = 1 - (i / 20);
                    shardViews.push(
                      <div 
                        key={i} 
                        className="rounded px-2 py-1 text-center transition-all"
                        style={{ 
                          backgroundColor: 'var(--activity)',
                          color: 'var(--fg)',
                          border: '1px solid var(--grid)',
                          minWidth: `${40 * scale}px`,
                          fontSize: `${Math.max(10, 14 * scale)}px`,
                          opacity: 0.5 + scale * 0.5
                        }}
                      >
                        <div className="text-xs opacity-75">S{i + 1}</div>
                        <div className="font-semibold">{shardSizeGB}GB</div>
                      </div>
                    );
                  }
                  
                  shardViews.push(
                    <div key="ellipsis" className="flex items-center px-2 font-bold" style={{ color: 'var(--muted)' }}>
                      ···
                    </div>
                  );
                  
                  shardViews.push(
                    <div 
                      key={calculations.totalShards - 1} 
                      className="rounded px-2 py-1 text-center"
                      style={{ 
                        backgroundColor: 'var(--activity)',
                        color: 'var(--fg)',
                        border: '1px solid var(--grid)',
                        minWidth: '40px', 
                        fontSize: '12px' 
                      }}
                    >
                      <div className="text-xs opacity-75">S{calculations.totalShards}</div>
                      <div className="font-semibold">{shardSizeGB}GB</div>
                    </div>
                  );
                }
                
                return shardViews;
              })()}
            </div>
            <div className="text-right mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              Total: {calculations.totalShards} shards × {shardSizeGB} GB = {(calculations.totalShards * shardSizeGB).toFixed(1)} GB
            </div>
          </div>
        </div>
      </div>

      {/* Shards to SSDs Distribution */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--panel)', boxShadow: '0 1px 3px var(--shadow)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>Shards → SSDs Mapping</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: W }).map((_, ssdIndex) => {
            const shards = calculations.shardDistribution[ssdIndex];
            const shardCount = shards.length;
            
            return (
              <div key={ssdIndex} className="border-2 rounded-lg p-4" style={{ borderColor: ssdColors[ssdIndex % ssdColors.length] }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ssdColors[ssdIndex % ssdColors.length] }}></div>
                  <div className="font-semibold" style={{ color: 'var(--fg)' }}>SSD {ssdIndex + 1}</div>
                </div>
                {shardCount > 0 ? (
                  <>
                    <div className="text-sm" style={{ color: 'var(--muted)' }}>
                      {shardCount === 1 
                        ? `Shard ${shards[0] + 1}` 
                        : shardCount <= 3
                        ? `Shards ${shards.map(s => s + 1).join(', ')}`
                        : `Shards ${shards[0] + 1}, ${shards[1] + 1}... (${shardCount} total)`
                      }
                    </div>
                    <div className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{(shardCount * shardSizeGB).toFixed(1)} GB</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {(shardCount * calculations.chunksPerShard).toLocaleString()} cmds
                    </div>
                  </>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--muted)', opacity: 0.5 }}>No data</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Command Stream Visualization */}
      <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--panel)', boxShadow: '0 1px 3px var(--shadow)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>CRC Command Stream</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Per Shard Breakdown</div>
              <div className="rounded p-3" style={{ backgroundColor: 'var(--panel-2)' }}>
                <div className="flex items-center justify-between" style={{ color: 'var(--fg)' }}>
                  <span>1 Shard ({shardSizeGB} GB)</span>
                  <span className="text-xl">→</span>
                  <span className="font-semibold">{calculations.chunksPerShard.toLocaleString()} chunks</span>
                  <span className="text-xl">×</span>
                  <span>{calculations.chunkSizeMB.toFixed(2)} MB each</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Command Generation</div>
            <div className="rounded-lg p-4" style={{ 
              background: state.dark 
                ? 'linear-gradient(135deg, rgba(36, 210, 138, 0.1), rgba(89, 168, 255, 0.1))'
                : 'linear-gradient(135deg, rgba(36, 210, 138, 0.05), rgba(89, 168, 255, 0.05))'
            }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--ok)' }}>
                    {calculations.totalChunks.toLocaleString()}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>Total CRC_READ_PLUS commands</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                    {calculations.chunkSizeMB < 0.1 
                      ? `${(chunkBytes / 1024).toFixed(1)} KB`
                      : `${calculations.chunkSizeMB.toFixed(2)} MB`
                    }
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>Data per command</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--warn)' }}>
                    {W}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>Parallel SSDs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Command Flow */}
          <div className="mt-6">
            <div className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Command Flow Visualization</div>
            <div className="relative h-32 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--panel-2)' }}>
              <svg width="100%" height="100%" className="absolute inset-0">
                {Array.from({ length: Math.min(20, calculations.totalChunks) }).map((_, i) => {
                  const ssdIndex = i % W;
                  const x = (i / 20) * 100;
                  const y = 20 + (ssdIndex / W) * 80;
                  return (
                    <g key={i}>
                      <circle
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r="3"
                        fill={ssdColors[ssdIndex % ssdColors.length]}
                        opacity="0.6"
                        className="animate-pulse"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                      <line
                        x1="0"
                        y1={`${y}%`}
                        x2={`${x}%`}
                        y2={`${y}%`}
                        stroke={ssdColors[ssdIndex % ssdColors.length]}
                        strokeWidth="1"
                        opacity="0.3"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-2 right-2 text-xs" style={{ color: 'var(--muted)' }}>
                Showing first {Math.min(20, calculations.totalChunks)} of {calculations.totalChunks.toLocaleString()} commands
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}