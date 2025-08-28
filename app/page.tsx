'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const solutions = [
    {
      title: 'Serial with Seeding',
      subtitle: 'Solution 1',
      features: [
        'Sequential processing using prior CRC as seed',
        'Linear latency growth with SSD count',
        'Requires host sequencing and retry logic'
      ]
    },
    {
      title: 'Parallel Host Aggregation',
      subtitle: 'Solution 2',
      features: [
        'Parallel per-SSD CRC computation',
        'Host combines using CRC64_COMBINE',
        'Higher host CPU utilization for aggregation'
      ]
    },
    {
      title: 'Parallel SSD Aggregation',
      subtitle: 'Solution 3',
      features: [
        'Parallel per-SSD CRC computation',
        'Aggregation offloaded to dedicated SSD',
        'Minimal host CPU with potential SSD hotspot'
      ]
    }
  ];

  return (
    <main className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
      {/* Navigation */}
      <nav className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}> 
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} flex items-center justify-center`}>
              <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>CRC</span>
            </div>
            <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-900'}`}>Validation Architectures</span>
          </div>
          <Link 
            href="/crc-workflow" 
            className={`text-sm px-4 py-2 rounded transition-colors ${
              isDark 
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Open Visualizer
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <header className="pt-20 pb-12">
          <h1 className={`text-4xl font-light ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
            CRC Validation with SSD Offload
          </h1>
          <p className={`mt-4 text-lg ${isDark ? 'text-zinc-500' : 'text-gray-600'} max-w-3xl`}>
            Explore three architectural approaches for offloading CRC computation from hosts to SSDs, 
            each with distinct performance characteristics and trade-offs.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/crc-workflow"
              className={`px-6 py-3 rounded text-sm font-medium transition-colors ${
                isDark 
                  ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' 
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              Interactive Visualizer
            </Link>
            <button
              className={`px-6 py-3 rounded text-sm font-medium transition-colors ${
                isDark 
                  ? 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800/50' 
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Documentation (TBD)
            </button>
          </div>
        </header>

        {/* Solutions Grid */}
        <section className="py-12 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}">
          <h2 className={`text-xs font-semibold uppercase tracking-wider mb-8 ${
            isDark ? 'text-zinc-600' : 'text-gray-500'
          }`}>
            Implementation Approaches
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {solutions.map((solution, index) => (
              <article
                key={index}
                className={`p-6 rounded-lg border ${
                  isDark 
                    ? 'border-zinc-800 hover:border-zinc-700' 
                    : 'border-gray-200 hover:border-gray-300'
                } transition-colors`}
              >
                <div className="mb-4">
                  <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${
                    isDark ? 'text-zinc-600' : 'text-gray-500'
                  }`}>
                    {solution.subtitle}
                  </p>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                    {solution.title}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {solution.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className={`block w-1 h-1 rounded-full mt-2 mr-3 flex-shrink-0 ${
                        isDark ? 'bg-zinc-600' : 'bg-gray-400'
                      }`} />
                      <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Technical Details */}
        <section className={`py-12 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-zinc-300' : 'text-gray-900'}`}>
                CRC64_COMBINE Algorithm
              </h3>
              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-600'} leading-relaxed`}>
                Enables parallel CRC computation by combining pre-computed CRCs through GF(2) polynomial 
                arithmetic. CRC(A) is shifted by 8×len(B) bits and XORed with CRC(B) to produce the 
                correct combined checksum.
              </p>
            </div>
            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-zinc-300' : 'text-gray-900'}`}>
                Performance Considerations
              </h3>
              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-600'} leading-relaxed`}>
                Solution selection depends on workload characteristics, available host CPU resources, 
                SSD capabilities, and latency requirements. The visualizer allows exploration of 
                these trade-offs with configurable parameters.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}