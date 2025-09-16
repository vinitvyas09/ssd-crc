Below is the **plan document** (Markdown) for the new enterprise-grade simulation tab. It’s detailed, implementation‑ready, but contains **no code**.

---

# Enterprise CRC Offload Simulator — “Enterprise” Tab Specification

**Owner:** Vinit
**Status:** Draft (planning)
**Purpose:** Introduce a new, isolated tab that elevates the current CRC simulator into an enterprise‑grade modeling tool covering host/SSD parallelism, aggregation strategies, queueing, and failure modes—without touching existing “Timing Diagram”, “Data Distribution”, “AI Chat”, and “Voice” tabs.

---

## 1) Goals & Scope

### Goals

* Provide **scenario‑driven** simulation for three architectures:

  1. Serial CRC with seeding (Solution 1)
  2. Parallel CRC + host aggregation (Solution 2)
  3. Parallel CRC + SSD aggregation (Solution 3)
* Offer **first‑class knobs** (topology, workload, NVMe/MDTS, queueing, aggregation policy, failure injection).
* Render **intuitive visuals** (timelines, queue heatmaps, throughput/latency distributions, critical path overlays).
* Enable **A/B/C comparison** across the three solutions with side‑by‑side metric panels.
* **Calibrate** the model using the C exerciser’s observable metrics (throughput, latency, mismatch rate) to keep simulation honest.
* Export/share **reproducible scenarios** and results.

### Non‑Goals

* No device firmware modeling beyond the level required to predict timing/aggregation.
* No live hardware execution—this is **pure simulation** (but calibrated).

---

## 2) Placement & Isolation

* Add a **new top‑level tab**: **Enterprise** (to the right of “Timing Diagram” and “Data Distribution”).
* The Enterprise tab mounts a self‑contained route/state slice (no shared mutable state with existing tabs).
* Cross‑tab interaction limited to **read‑only** imports (e.g., pulling stripe maps produced in “Data Distribution” as an optional input).

---

## 3) UX Overview

### 3.1 Layout (two‑pane with optional third band)

* **Left: Scenario Builder** (controls & presets)
* **Right: Results & Visualizations** (multi‑view, selectable)
* **Bottom (collapsible): Event Log & Model Assumptions** (shows derived parameters, warnings, calibration notes)

### 3.2 Primary Modes (pill selector at top of Scenario Builder)

* **Single‑Solution**: Simulate one of {S1, S2, S3}
* **Compare**: Run S1/S2/S3 with the same scenario and render side‑by‑side KPIs + stacked visualizations
* **What‑If Sweep**: Sweep a single knob across a range (e.g., SSD count 4→32) and plot trendlines

---

## 4) Scenario Builder (Knobs) — Groups & Mapping

> **Note:** Wherever possible, parameters align with the **crc exerciser** semantics for familiarity and calibration.

### 4.1 Topology

* **Stripe Width (x)**: total SSDs participating for the object (e.g., 4–32)
* **Erasure Coding (k+m)**: logical data (k) + parity (m); affects aggregation order and total chunks
* **Aggregator SSD policy (S3 only)**: *pinned*, *round‑robin*, *least‑loaded*
* **PCIe Gen & Lanes / SSD**: Gen4/Gen5, x4/x8 (affects command/control timing headroom—not bulk data)

### 4.2 Workload

* **Objects in Flight**: concurrent files validated
* **File Size**: bytes per object
* **Chunk (extent) Size**: bytes per CRC job sent to each SSD
* **Stripe Map Source**: *Uniform* | *Imported from Data Distribution tab*
* **Access Order**: *stripe order*, *randomized* (impacts cache/queue behavior)

### 4.3 NVMe / Command Settings

* **MDTS (bytes)**: controller limit; caps per‑command size
* **Read+ NLB**: 1–4 (mirror `--readplus nlb`)
* **Queue Depth / Threading**: per‑SSD queue depth; host threads (mirror `--queuedepth`, `NUM_VERIFY_THREADS`)
* **Flush Between Phases**: on/off (mirror `--flush` semantics)
* **Seeded vs Zero Seed**: S1 uses seeded chaining; S2/S3 use zero seed

### 4.4 Device & Compute Models

* **Per‑SSD CRC Service Time Model**: distribution (deterministic / lognormal / gamma) with μ/σ (μ from calibration)
* **Aggregation Cost**

  * **Host combine (S2)**: cost per `CRC64_COMBINE()` op as function of chunk length; log₂(x) stage tree
  * **SSD combine (S3)**: DPU aggregation latency baseline + per‑element slope
* **Command Overheads**: submission/completion, DMA setup (constant + variance)

### 4.5 Failure & Jitter

* **Timeout Probability per cmd**
* **Retry Backoff Strategy**: fixed / exponential; cap
* **CRC Mismatch Rate (for sensitivity)**
* **Straggler Distribution**: heavy‑tail tuning for p95/p99

### 4.6 Calibration

* **Import Exerciser Logs** (paste or file): parse `V[i]: … KB/s … usecs … mismatch …` lines to back‑compute μ/σ for:

  * per‑4096B CRC latency
  * avg command overhead
  * queue interaction under given QD, threads
* **Calibration Profile Name**: save/load

### 4.7 Presets

* **“Baseline 8× Gen4x4 (No Jitter)”**
* **“16× with Host Aggregate”**
* **“16× with SSD Aggregate”**
* **“Stress: 32×, p99 stragglers”**
* **“Match Exerciser: QD=… Threads=… Read+NLB=…”** (auto‑filled from calibration import)

---

## 5) Results & Visualizations

### 5.1 KPI Header (always visible)

* **Latency:** p50 / p95 / p99 per object
* **Throughput:** objects/s, CRCs/s
* **Critical Path:** quantified (e.g., `max(SSD_i) + agg`) with driver breakdown
* **Host CPU Estimate:** % / cores (S2 > S1 > S3)
* **PCIe Control Traffic:** relative utilization per SSD and for aggregator
* **Mismatch / Retry Stats**

### 5.2 Visual Views (tabs on the right pane)

1. **Timeline (Gantt)**

   * Lanes per SSD + optional Host/Aggregator lane
   * Show command windows, compute spans, waits, retries
   * Toggle overlay: **critical path** highlight
2. **Queue Heatmap**

   * Per‑SSD queue occupancy over time, back‑pressure episodes
3. **Distribution Panel**

   * Latency PDF/CDF; straggler analysis; per‑SSD boxplots
4. **Aggregation Tree (S2/S3)**

   * Visual XOR/shift tree depth (log₂x), staged timing, per‑stage costs
5. **Compare Mode Matrix**

   * S1 vs S2 vs S3 KPIs side‑by‑side plus delta bars
6. **Failure Runbook**

   * When a timeout is sampled, show the host’s policy path (retry, reseed, fallbacks)

### 5.3 Export

* **Export Scenario** (.json with knobs and seed)
* **Export Results** (.csv for KPIs, histogram bins, queue traces)
* **Shareable Snapshot** (read‑only link or bundle)

---

## 6) Simulation Model (Deterministic Core + Stochastic Envelopes)

### 6.1 Object → Stripe → Chunks

* An object maps to x SSDs (per stripe), chunked by **Chunk Size** ≤ **MDTS**.
* Total chunk count per object = `ceil(FileSize / ChunkSize)`.
* For EC (k+m), set aggregation order to respect stripe/placement.

### 6.2 Command Phases (per chunk)

* **Submit → FW queue → Compute(CRC) → Complete**, each with (base + jitter).
* Control‑plane bytes are negligible vs data, but **modeled for latency**.

### 6.3 Timing Formulas (per object)

Let:

* `Ti` = per‑SSD completion time for all chunks belonging to that object’s stripe on SSD i (includes its local queueing + compute).
* `Agg_host(x)` = host aggregation time for x inputs (S2).
* `Agg_ssd(x)` = SSD aggregation time for x inputs (S3).
* `Overheads` = host orchestration + final completion bookkeeping.

**S1 (Serial Seeded):**

* **Fill**: roughly sum of per‑chunk per‑SSD times in strict order.
* **Steady‑state** (pipeline): latency ≈ initial fill + `(chunks_per_object - 1) × stage_time`.
* Simulator computes both and reports conservative bound and steady‑state.

**S2 (Parallel + Host Combine):**

* Latency ≈ `max_i(Ti)` + `Agg_host(x)` + `Overheads`
* `Agg_host(x)` modeled as `c0 + c1·x + c2·log2(x)` where:

  * `c1` tracks per‑element `CRC64_COMBINE()` cost (depends on **len**),
  * `c2` accounts for staged tree, cache effects, reductions.

**S3 (Parallel + SSD Combine):**

* Latency ≈ `max_i(Ti)` + `Agg_ssd(x)` + `Overheads`
* `Agg_ssd(x)` modeled as `d0 + d1·x` with lower slope than host; aggregator‑lane congestion reflected in queueing if many objects target the same SSD.

### 6.4 CRC64\_COMBINE Semantics

* Combine is the **GF(2)** left‑shift of CRC(A) by `8·len(B)` bits modulo the polynomial, XOR with CRC(B).
* We **do not compute CRC values** here; we **budget time** for combine ops proportional to chunk lengths.
* Reference for correctness/calibration: your provided demonstration and NVMe CRC64 (Rocksoft) parameters.

### 6.5 Queueing & Stragglers

* SSD service times sampled from configured distribution; queueing modeled M/G/1 per SSD lane (or constrained by set QD).
* Stragglers: heavy‑tail multiplier affecting tail percentiles.
* Retries: when a completion is marked failed, re‑enqueue with policy delays.

---

## 7) Calibration (using the C Exerciser)

### 7.1 Source Signals (from logs)

* Lines of the form
  `V[t]: <mismatch>/<count> CRCs | <KB> in <msecs>: <KB/s> <CRCs/sec> <mismatch%> (Avg latency <usecs> per <bytes> <CRC|File>)`
* Inputs to infer:

  * **Per-4096B CRC μ (µs)** and variance
  * **Command overheads** per Read/Read+ (submit+CQE handling)
  * **Queue interaction** under given `--queuedepth`, threads

  Latest exerciser capture (4 KiB chunks, offload enabled) delivered ~11.7 k CRCs/s over 5 s with the tool reporting “Avg latency 85 µs”. A parallel `strace` showed synchronous `ioctl` completions averaging 134 µs (σ≈35 µs), which decomposes into ~110 µs of CRC execution plus ~12 µs submit/complete on each side. The baseline preset now reflects that split so queue models stay faithful once we add per-command NVMe latency.

### 7.2 Mapping (UI ↔ exerciser)

| UI Knob              | Exerciser Flag / Field   | Notes                                      |
| -------------------- | ------------------------ | ------------------------------------------ |
| Queue Depth          | `--queuedepth <depth>`   | per‑thread runtime QD                      |
| Threads              | `NUM_VERIFY_THREADS` (8) | fixed in sample, made a knob in UI         |
| Read+ NLB            | `--readplus nlb <nlb>`   | 1–4; bounded by `READPLUS_MAX_NLB`         |
| Chain Count          | `--file <#blocks>`       | used to emulate file size                  |
| Flush Between Phases | `--flush`                | write‑cache behavior                       |
| SW CRC Mode          | `--readswcrc`            | disables offload; for baseline calibration |
| Randomize Writes     | `--randomwrites`         | jitter during seeding                      |
| MDTS                 | Identify‑derived         | caps per‑command length                    |

### 7.3 Profiles

* Save **Calibration Profiles** keyed by device family / firmware.
* Apply profile defaults to new scenarios; allow per‑scenario overrides.

---

## 8) Validation Strategy

* **Golden micro‑scenarios**:

  * Single SSD, single chunk → latency matches measured μ ± tolerance.
  * 8 SSDs, equal chunks, no jitter → `max_i(Ti)` close to individual μ.
  * Compare S2 vs S3 on same scenario; S3 should win by `Agg_host - Agg_ssd` unless aggregator contention kicks in.
* **Back‑to‑back**: Generate a scenario that mirrors a known exerciser run; ensure headline numbers are within **±10–15%**.

---

## 9) Edge Cases & Constraints

* **MDTS violations**: auto‑clamp chunk size; surface warning.
* **Read+NLB × ChainCount** exceeding MDTS: mirror tool’s error behavior (reject with guidance).
* **Aggregator Hotspot (S3)**: if many objects pick same SSD, show **aggregator‑lane saturation** warning and the effect in timelines.
* **High SSD count (>24)**: warn about model fidelity for tail latencies unless calibrated at that scale.

---

## 10) Non‑Functional

* **Deterministic Replays**: scenario carries a random seed; re‑runs yield identical samples.
* **Performance**: simulate **10–100k** commands/s interactively; larger runs batch‑compute and stream results to charts.
* **State Persistence**: autosave last scenario; explicit save slots.
* **No code coupling** with existing tabs; feature‑flagged rollout.

---

## 11) Implementation Plan (Phased, no code here)

**Phase 0 – Skeleton & Isolation**

* New **Enterprise** tab route, empty shell.
* Scenario state store + schema, import/export of scenario JSON.

**Phase 1 – Core Engine & KPIs**

* Deterministic timeline generator for S1/S2/S3.
* KPI header (latency, throughput).
* Basic timeline (Gantt) view.

**Phase 2 – Calibration & Validation**

* Log parser for exerciser output; fit μ/σ.
* Profiles; golden micro‑scenarios.

**Phase 3 – Advanced Visualization**

* Queue heatmap; aggregation tree view; failure runbook; compare mode matrix.

**Phase 4 – What‑If Sweeps & Advisor**

* Param sweeps; recommendation hints (e.g., “S3 wins by X%—but aggregator is hotspot at ≥N concurrent files”).

**Phase 5 – Polish**

* Exports; presets; warnings; accessibility; docs.

---

## 12) Risks & Mitigations

* **Calibration Misfit**: Provide visible confidence bands; expose knobs for manual tuning.
* **Aggregator Contention Modeling**: Start with single‑lane FIFO per SSD; iterate if traces show mismatch.
* **User Error (invalid combos)**: Proactive validation + inline guidance.

---

## 13) Appendix A — KPI Definitions

* **Object Latency (p50/p95/p99)**: submit‑to‑final‑CRC completion per object.
* **Throughput**: completed objects/s and CRCs/s.
* **Critical Path Attribution**: `%` of latency spent in compute vs queue vs aggregation.
* **Host CPU Estimate**: per‑operation cycle model (S2 > S1 > S3) scaled by concurrency.

---

## 14) Appendix B — Default Parameter Values (initial)

* **LBA Size**: 4096 B (to match exerciser)
* **Read+ NLB**: 1 (default), max 4
* **Threads**: 8
* **QD**: 32 (cap 128)
* **MDTS**: from Identify (or default 1 MiB if “unlimited” in caps)
* **PCIe**: Gen4 x4 per SSD unless changed
* **Service Time (per 4 KiB CRC)**: seeded from calibration (fallback μ=110 µs based on latest exerciser trace; adjust once calibrated)
* **Aggregation Costs (starting points):**

  * Host `c0=5 µs, c1=0.4 µs/element per 4 KiB, c2=2 µs·log₂(x)`
  * SSD `d0=12 µs, d1=0.15 µs/element`
    *(All to be learned/updated by calibration.)*

---

## 15) Appendix C — How This Mirrors the Provided References

* **Solutions 1–3**: Directly mirrored from your “Project Explanation” section, including command seeding (S1), zero‑seed fan‑out (S2/S3), and aggregation locus.
* **CRC64\_COMBINE semantics**: Modeled for **time**, not value, but correctness is grounded in the same GF(2) shifting/XOR principle validated by your incrementing‑pattern and all‑zero test vectors.
* **crc exerciser alignment**:

  * **QD / Threads / NLB / Chain Count / Flush / SW‑CRC** surfaced as knobs with the same meanings.
  * **Identify/MDTS** constraints replicated (auto‑clamp + warnings).
  * Progress metrics and average latency language reflected in KPI outputs.

---

**End of Spec**
