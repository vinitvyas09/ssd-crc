'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const solutions = [
    {
      title: "Serial CRC with Seeding",
      number: "1",
      color: "#59a8ff",
      features: [
        "Sequential CRC across SSDs using prior CRC as seed",
        "Latency grows with SSD count; steady-state pipeline",
        "Simple math; more host sequencing/retry logic"
      ]
    },
    {
      title: "Parallel CRC + Host Aggregation",
      number: "2",
      color: "#ffcc40",
      features: [
        "Parallel per-SSD CRC with host-side CRC64_COMBINE",
        "Latency ≈ slowest SSD + log₂(W) combine stages",
        "Highest host CPU for fan-in and aggregation"
      ]
    },
    {
      title: "Parallel CRC + SSD Aggregation",
      number: "3",
      color: "#24d28a",
      features: [
        "Parallel per-SSD CRC; aggregation offloaded to an SSD",
        "Latency ≈ slowest SSD + small aggregation time",
        "Minimal host CPU; aggregator SSD may hotspot"
      ]
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0b0f14] via-[#111821] to-[#0e141b]">
      <div
        className="absolute inset-0 opacity-15 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='%23233040' stroke-width='0.5' opacity='0.25'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E")`
        }}
      ></div>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:py-20 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl text-center mb-12 sm:mb-16"
        >
          <motion.h1
            className="text-[28px] sm:text-4xl md:text-5xl lg:text-[56px] font-extrabold tracking-tight bg-gradient-to-r from-[#a8d4ff] via-[#e6f1ff] to-[#a8d4ff] bg-clip-text text-transparent leading-tight sm:leading-tight md:leading-[1.1]"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{ backgroundSize: "250% 250%" }}
          >
            CRC Validation Workflows
          </motion.h1>

          <p className="mt-4 sm:mt-6 text-[13px] sm:text-base md:text-lg text-[#b8c6d8] leading-relaxed md:leading-8 px-0 sm:px-6">
            Explore three approaches to offload CRC computation from hosts to SSDs in erasure‑coded systems.
            Compare performance, scalability, and implementation complexity.
          </p>

          <motion.div
            className="mt-8 sm:mt-10 inline-block"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Link
              href="/crc-workflow"
              className="group relative inline-flex items-center gap-3 rounded-xl px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base text-white font-semibold overflow-hidden shadow-lg ring-1 ring-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#59a8ff] to-[#70b4ff] transition-transform duration-300 group-hover:scale-105"></div>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{ background: "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.8), transparent 60%)" }}
              ></div>
              <span className="relative">Launch Interactive Visualizer</span>
              <svg className="relative w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>

        <div className="grid gap-5 sm:gap-6 md:gap-8 md:grid-cols-3 mt-12 sm:mt-16 md:mt-20 px-2 sm:px-0">
          {solutions.map((solution, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
              className="relative group h-full"
            >
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
                style={{ background: `radial-gradient(circle at center, ${solution.color}40, transparent)` }}
              />
              <div className="relative rounded-2xl border border-[#233040] bg-gradient-to-b from-[#111821] to-[#0e141b] p-6 sm:p-7 transition-all duration-300 group-hover:border-[#2a3a4d] transform group-hover:-translate-y-1 flex flex-col h-full">
                <div className="mb-4 sm:mb-6">
                  <motion.div 
                    className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-3 sm:mb-4"
                    style={{ backgroundColor: `${solution.color}20` }}
                    animate={{ rotate: hoveredCard === index ? 360 : 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="text-xl font-bold" style={{ color: solution.color }}>{solution.number}</span>
                  </motion.div>
                  <h2 className="text-[17px] sm:text-xl font-semibold text-[#e6eef7] leading-snug">{solution.title}</h2>
                </div>
                
                <ul className="space-y-3 sm:space-y-4 flex-grow">
                  {solution.features.map((feature, idx) => (
                    <motion.li 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 + idx * 0.05 }}
                      className="flex items-start gap-3"
                    >
                      <svg 
                        className="w-5 h-5 mt-0.5 flex-shrink-0 transition-colors"
                        style={{ color: hoveredCard === index ? solution.color : '#6b7a8a' }}
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[13px] sm:text-[15px] leading-relaxed text-[#aab8ca]">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-14 sm:mt-20 rounded-2xl border border-[#233040] bg-gradient-to-b from-[#111821] to-[#0e141b] p-6 sm:p-10 relative overflow-hidden mx-2 sm:mx-0"
        >
          <div className="absolute -top-10 -right-10 w-72 h-72 bg-gradient-to-br from-[#59a8ff] to-transparent opacity-10 rounded-full blur-3xl"></div>
          <div className="relative">
            <h3 className="text-base sm:text-xl font-semibold text-[#e6eef7] mb-3 sm:mb-4">Technical Deep Dive: CRC64_COMBINE</h3>
            <p className="text-[13px] sm:text-base text-[#9fb0c4] leading-relaxed max-w-4xl">
              The combination step shifts CRC(A) by 8·len(B) bits in GF(2) and XORs with CRC(B), enabling
              correct aggregation without re‑reading data. This property powers the parallel models
              (Solutions 2 and 3) for efficient distributed computation.
            </p>
            <div className="mt-5 sm:mt-6 flex items-start sm:items-center gap-3 text-xs sm:text-sm text-[#617185]">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Use the visualizer to explore how parameters affect performance across different architectures.</span>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}