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

  const ssdColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#a855f7', '#14b8a6', '#eab308'
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Statistics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Object Size</div>
          <div className="text-2xl font-bold">{objectSizeGB} GB</div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Shards</div>
          <div className="text-2xl font-bold">{calculations.totalShards}</div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Chunks per Shard</div>
          <div className="text-2xl font-bold">{calculations.chunksPerShard.toLocaleString()}</div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total CRC Commands</div>
          <div className="text-2xl font-bold">{calculations.totalChunks.toLocaleString()}</div>
        </div>
      </div>

      {/* Object to Shards Breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Object → Shards Distribution</h3>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-4 text-white">
              <div className="text-sm opacity-90">Host Object</div>
              <div className="text-3xl font-bold">{objectSizeGB} GB</div>
            </div>
          </div>
          
          <div className="flex-1 flex justify-center">
            <svg width="100" height="50" className="text-gray-400">
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
                        className="bg-blue-100 dark:bg-blue-900 rounded px-2 py-1 text-center"
                        style={{ 
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
                        className="bg-blue-100 dark:bg-blue-900 rounded px-2 py-1 text-center transition-all"
                        style={{ 
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
                    <div key="ellipsis" className="flex items-center px-2 text-gray-500 dark:text-gray-400 font-bold">
                      ···
                    </div>
                  );
                  
                  shardViews.push(
                    <div 
                      key={calculations.totalShards - 1} 
                      className="bg-blue-100 dark:bg-blue-900 rounded px-2 py-1 text-center"
                      style={{ minWidth: '40px', fontSize: '12px' }}
                    >
                      <div className="text-xs opacity-75">S{calculations.totalShards}</div>
                      <div className="font-semibold">{shardSizeGB}GB</div>
                    </div>
                  );
                }
                
                return shardViews;
              })()}
            </div>
            <div className="text-right mt-2 text-sm text-gray-600 dark:text-gray-400">
              Total: {calculations.totalShards} shards × {shardSizeGB} GB = {(calculations.totalShards * shardSizeGB).toFixed(1)} GB
            </div>
          </div>
        </div>
      </div>

      {/* Shards to SSDs Distribution */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Shards → SSDs Mapping</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: W }).map((_, ssdIndex) => {
            const shards = calculations.shardDistribution[ssdIndex];
            const shardCount = shards.length;
            
            return (
              <div key={ssdIndex} className="border-2 rounded-lg p-4" style={{ borderColor: ssdColors[ssdIndex % ssdColors.length] }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ssdColors[ssdIndex % ssdColors.length] }}></div>
                  <div className="font-semibold">SSD {ssdIndex + 1}</div>
                </div>
                {shardCount > 0 ? (
                  <>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {shardCount === 1 
                        ? `Shard ${shards[0] + 1}` 
                        : shardCount <= 3
                        ? `Shards ${shards.map(s => s + 1).join(', ')}`
                        : `Shards ${shards[0] + 1}, ${shards[1] + 1}... (${shardCount} total)`
                      }
                    </div>
                    <div className="text-lg font-bold">{(shardCount * shardSizeGB).toFixed(1)} GB</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {(shardCount * calculations.chunksPerShard).toLocaleString()} cmds
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-600">No data</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Command Stream Visualization */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">CRC Command Stream</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Per Shard Breakdown</div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3">
                <div className="flex items-center justify-between">
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
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Command Generation</div>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {calculations.totalChunks.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total CRC_READ_PLUS commands</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {calculations.chunkSizeMB.toFixed(2)} MB
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Data per command</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {W}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Parallel SSDs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Command Flow */}
          <div className="mt-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Command Flow Visualization</div>
            <div className="relative h-32 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
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
              <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
                Showing first {Math.min(20, calculations.totalChunks)} of {calculations.totalChunks.toLocaleString()} commands
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}