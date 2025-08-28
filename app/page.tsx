'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check if user prefers dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const solutions = [
    {
      title: 'Serial CRC with Seeding',
      number: '1',
      color: '#5aa9ff',
      features: [
        'Sequential across SSDs using prior CRC as seed',
        'Latency grows with SSD count; pipelined steady state',
        'More host sequencing and retry logic'
      ]
    },
    {
      title: 'Parallel CRC + Host Aggregation',
      number: '2',
      color: '#9b87f5',
      features: [
        'Per‑SSD CRC in parallel; host combines with CRC64_COMBINE',
        'Latency ≈ slowest SSD + log₂(W) combine stages',
        'Highest host CPU for fan‑in and aggregation'
      ]
    },
    {
      title: 'Parallel CRC + SSD Aggregation',
      number: '3',
      color: '#22d39c',
      features: [
        'Per‑SSD CRC in parallel; aggregation offloaded to an SSD',
        'Latency ≈ slowest SSD + small aggregation time',
        'Minimal host CPU; aggregator SSD may hotspot'
      ]
    }
  ];

  return (
    <main className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0c111b]' : 'bg-gray-50'}`}>
      {/* Top bar */}
      <div className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'} sticky top-0 z-20 backdrop-blur`}> 
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="CRC" className="h-6 w-6" />
            <span className={`text-sm font-medium ${isDark ? 'text-white/90' : 'text-gray-900'}`}>CRC Simulator</span>
          </div>
          <Link href="/crc-workflow" className={`text-sm font-medium rounded-lg px-3 py-1.5 transition-colors ${isDark ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}`}>Visualizer</Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-8 sm:pt-24 sm:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className={`text-[28px] sm:text-[40px] md:text-[48px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>CRC Validation Architectures</h1>
          <p className={`mt-4 text-[14px] sm:text-[16px] ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            Three ways to compute file CRCs across multiple SSDs: serial seeding, parallel with host aggregation, and parallel with SSD aggregation.
          </p>
          <div className="mt-8">
            <Link
              href="/crc-workflow"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm bg-gradient-to-r from-[#5aa9ff] to-[#22d39c] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Launch Visualizer
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Solutions */}
      <section className="mx-auto max-w-7xl px-6 pb-16 sm:pb-20 md:pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {solutions.map((solution, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`relative rounded-xl border p-6 sm:p-7 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'} transition-transform duration-300 ${hoveredCard === index ? '-translate-y-1' : ''}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: `${solution.color}1a` }}>
                  <span className="text-sm font-semibold" style={{ color: solution.color }}>{solution.number}</span>
                </div>
                <h2 className={`text-[16px] sm:text-[18px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{solution.title}</h2>
              </div>
              <ul className="space-y-3">
                {solution.features.map((feature, idx) => (
                  <li key={idx} className={`text-sm leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{feature}</li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>

        {/* CRC64_COMBINE Note */}
        <div className={`mt-12 sm:mt-16 rounded-xl border p-6 sm:p-8 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-[15px] sm:text-[17px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>CRC64_COMBINE</h3>
          <p className={`mt-2 text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
            Combine pre‑computed CRCs by shifting CRC(A) by 8·len(B) bits in GF(2) and XORing with CRC(B). This enables fully parallel per‑SSD CRC with correct end‑to‑end validation.
          </p>
        </div>
      </section>
    </main>
  );
}