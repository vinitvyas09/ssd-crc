import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">CRC Host Solutions</h1>
          <p className="mt-3 text-sm text-[var(--foreground)]/80 max-w-3xl">
            Three architectural approaches for offloading CRC computation from hosts to SSDs in erasure-coded systems. Explore tradeoffs in performance, scalability, and implementation complexity, and visualize the end-to-end workflow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/crc-workflow"
              className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors"
              style={{
                background: 'var(--background)',
                borderColor: 'color-mix(in oklab, var(--foreground) 18%, transparent)',
              }}
            >
              Launch interactive visualizer
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article
            className="rounded-xl border p-5"
            style={{
              background: 'color-mix(in oklab, var(--background) 96%, transparent)',
              borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
            }}
          >
            <h2 className="text-base font-semibold">Solution 1: Serial CRC with seeding</h2>
            <ul className="mt-2 text-sm leading-6 opacity-80 list-disc pl-5">
              <li>Sequential CRC across SSDs using prior CRC as seed</li>
              <li>Latency grows with SSD count; steady-state pipeline</li>
              <li>Simple math; more host sequencing/retry logic</li>
            </ul>
          </article>

          <article
            className="rounded-xl border p-5"
            style={{
              background: 'color-mix(in oklab, var(--background) 96%, transparent)',
              borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
            }}
          >
            <h2 className="text-base font-semibold">Solution 2: Parallel CRC + Host Aggregation</h2>
            <ul className="mt-2 text-sm leading-6 opacity-80 list-disc pl-5">
              <li>Parallel per-SSD CRC with host-side CRC64_COMBINE</li>
              <li>Latency ≈ slowest SSD + log₂(W) combine stages</li>
              <li>Highest host CPU for fan-in and aggregation</li>
            </ul>
          </article>

          <article 
            className="rounded-xl border p-5"
            style={{
              background: 'color-mix(in oklab, var(--background) 96%, transparent)',
              borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
            }}
          >
            <h2 className="text-base font-semibold">Solution 3: Parallel CRC + SSD aggregation</h2>
            <ul className="mt-2 text-sm leading-6 opacity-80 list-disc pl-5">
              <li>Parallel per-SSD CRC; aggregation offloaded to an SSD</li>
              <li>Latency ≈ slowest SSD + small aggregation time</li>
              <li>Minimal host CPU; aggregator SSD may hotspot</li>
            </ul>
          </article>
        </div>

        <div className="mt-10 rounded-xl border p-5"
          style={{
            background: 'color-mix(in oklab, var(--background) 96%, transparent)',
            borderColor: 'color-mix(in oklab, var(--foreground) 14%, transparent)',
          }}
        >
          <h3 className="text-sm font-semibold">Appendix: CRC64_COMBINE</h3>
          <p className="mt-2 text-sm opacity-80 max-w-3xl">
            The combination step shifts CRC(A) by 8·len(B) bits in GF(2) and XORs with CRC(B), enabling correct aggregation without re-reading data. This property powers the parallel models (Solutions 2 and 3).
          </p>
          <p className="mt-2 text-xs opacity-70">
            Tip: Use the visualizer to toggle solutions, stripe width, and timing to see their impact.
          </p>
        </div>
      </section>
    </main>
  );
}
