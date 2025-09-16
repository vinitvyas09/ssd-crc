# Enterprise Tab — Phased E2E Plan (no code)

**Owner:** Vinit
**Audience:** Engineering + UX
**Intent:** Deliver an enterprise‑grade CRC offload simulator in **small, vertical slices**. Every phase ships a **runnable, viewable** simulation with clear acceptance checks. No changes to existing tabs.

---

## 0) What the new **Enterprise** tab looks like (at a glance)

**Layout**

* **Left pane — Scenario Builder**
  Groups: *Topology • Workload • NVMe/Command • Compute & Aggregation • Failures & Jitter • Calibration • Presets*
  *(Disabled controls appear with tooltips when not yet supported in the current phase).*

* **Right pane — Results**
  Views: *KPI Header (always visible) • Timeline (Gantt) • Queue Heatmap • Distributions • Aggregation Tree • Compare Matrix*
  *(We add views as phases progress; earlier phases show Timeline + KPIs only.)*

* **Bottom band — Event Log & Assumptions (collapsible)**
  Shows derived parameters, sampled events (retries/stragglers), and any warnings (e.g., MDTS clamp).

**Primary modes (pill selector, top‑left of Scenario Builder)**

* **Single Solution:** S1 *or* S2 *or* S3
* **Compare:** S1 vs S2 vs S3 on identical scenario (appears in Phase 3)
* **What‑If Sweep:** vary one knob across a range (appears in Phase 4)

---

## 1) Phase map (progressive capability)

| Phase | Ships E2E? | Solutions                  | Stochasticity                    |              Calibration             | Compare/Sweeps                       | Advanced Views                   |         Export         |
| ----: | :--------: | :------------------------- | :------------------------------- | :----------------------------------: | :----------------------------------- | :------------------------------- | :--------------------: |
|     1 |      ✅     | **S2 only**                | none (deterministic)             |                   —                  | —                                    | Timeline + KPIs                  |      Scenario only     |
|     2 |      ✅     | **S1 + S3** (alongside S2) | none                             |                   —                  | —                                    | + Aggregation Tree (basic)       | Scenario + Results CSV |
|     3 |      ✅     | S1/S2/S3                   | **jitter, stragglers, failures** |                   —                  | **Compare**                          | + Queue Heatmap, Failure Runbook |     Snapshot bundle    |
|     4 |      ✅     | S1/S2/S3                   | full                             | **Log‑based calibration** (profiles) | Compare                              | + Confidence bands on KPIs       |        Profiles        |
|     5 |      ✅     | S1/S2/S3                   | full                             |              calibrated              | **What‑If Sweeps** (+ advisor hints) | + Distributions (PDF/CDF)        |      Sweep exports     |
|     6 |      ✅     | S1/S2/S3                   | full                             |              calibrated              | full                                 | polish, accessibility, presets   |           All          |
|     7 |      ✅     | S1/S2/S3                   | full                             |              calibrated              | full                                 | + Derived KPI overlays           |           All          |

> *Deterministic first to guarantee a clear reference path, then add realism.*

---

## 2) Phase‑by‑Phase details

### **Phase 1 — Thin vertical slice (S2 only, deterministic)**

**Goal**
Prove the end‑to‑end loop for **Parallel CRC + Host Aggregation (S2)** with fixed service times: run → see KPIs → inspect Timeline.

**Scope**

* **Scenario Builder (minimal):**

  * Topology: Stripe Width (x), Objects in Flight (1 default), File Size, Chunk Size.
  * Compute & Aggregation: **Solution = S2**, Host Aggregation cost: constants `c0, c1, c2` exposed as numeric inputs.
  * NVMe/Command: MDTS (read‑only display), Queue Depth (per‑SSD), Threads (display only).
  * Presets: “Baseline 8× Gen4x4 (Deterministic)”.
* **Simulation engine:**

  * Deterministic per‑SSD CRC time per chunk (no jitter).
  * Per‑SSD timeline assembly; object latency = **max(SSD\_i)** + `Agg_host(x)` + orchestration overhead.
  * Enforce MDTS by splitting chunks (with a visible warning if clamped).
* **Results:**

  * **KPI header:** p50/p95/p99 (equal in this phase), Throughput (objects/s), Critical‑path breakdown (SSD vs Host Agg).
  * **Timeline (Gantt):** lanes per SSD + Host lane; critical‑path highlight.

**E2E demo (what the user does & sees)**

1. Open **Enterprise** → *Single Solution*.
2. Load preset “Baseline 8× …”.
3. Click **Run** → KPIs render; Timeline shows 8 SSD lanes computing in parallel; Host lane shows aggregation bar.
4. Toggle **Critical Path** → Host aggregation highlighted with `max(SSD_i)`.

**Acceptance**

* Changing **Stripe Width** from 8→16 increases `Agg_host(x)` and can change `max(SSD_i)`; KPIs update deterministically.
* MDTS clamp turns **Chunk Size** label amber with a tooltip explaining the split.
* Scenario can be **exported** (JSON) and **re‑imported** to reproduce identical KPIs.

**Out of scope now**: S1/S3, randomness, Compare, Heatmap.

---

### **Phase 2 — Add S1 and S3 (still deterministic)**

**Goal**
Allow users to pick **any** of S1, S2, S3 and see the different critical paths; introduce a **basic Aggregation Tree** view.

**Scope**

* **Scenario Builder:**

  * Solution selector offers **S1**, **S2**, **S3**.
  * **Aggregator SSD policy** (S3): *pinned* (default), *round‑robin*.
  * Per‑SSD deterministic service time still fixed.
* **Simulation engine:**

  * **S1 (Serial seeded):** strict ordering; compute **fill** and **steady‑state** estimates; report the conservative one.
  * **S3 (SSD aggregate):** add `Agg_ssd(x) = d0 + d1·x`; place aggregation on chosen SSD lane (no congestion yet). **Document the hardware tradeoff** — `d0` captures command fan-in across NVMe, `d1` represents ARM-core aggregate cost so teams can model slower on-device combine vs host CPU. Guidance lives in Results copy/tooltips.
* **Results:**

  * **Aggregation Tree (basic):** shows depth `log₂x` for S2 and single‑stage device combine for S3 with labeled stage costs.
  * **Export Results** (CSV): KPIs + per‑lane segment timings.

**E2E demo**

1. Run S1 with same preset; see higher latency and a long serial critical path.
2. Switch to S3; latency drops vs S2 by ≈ (`Agg_host(x)` − `Agg_ssd(x)`).
3. Open Aggregation Tree → See host vs device aggregation shape differences.

**Acceptance**

* For identical inputs: `Latency(S1) > Latency(S2)`; S3 varies with device coefficients (defaults assume slower ARM aggregation so `Latency(S3) ≥ Latency(S2)` until tuned).
* CSV export rows sum to the object latency within ±1 µs (deterministic).

**Out of scope now**: randomness, failures, Compare, Heatmap.

---

### **Phase 3 — Reality: jitter, stragglers, failures + Compare**

**Goal**
Introduce stochastic behavior and **Compare Mode** so users can see distributions and tail effects across S1/S2/S3.

**Scope**

* **Scenario Builder additions:**

  * **Service time distribution** (deterministic / lognormal / gamma) with μ, σ (per 4 KiB CRC).
  * **Straggler tail** controls (p95 multiplier, p99 multiplier).
  * **Failure & Retry:** timeout probability per command; retry policy (fixed / exponential backoff + cap).
* **Simulation engine:**

  * Sample per‑chunk service times; model M/G/1 style queueing per SSD constrained by QD.
  * On failure, re‑enqueue chunk per policy; record retries.
  * **Aggregator congestion (S3):** aggregator SSD becomes a resource with its own queue for the combine step.
* **Results:**

  * **Compare Mode:** side‑by‑side KPIs; delta bars vs best.
  * **Queue Heatmap:** per‑SSD occupancy over time.
  * **Failure Runbook:** event list of timeouts, retries, and their impact (latency deltas).

**E2E demo**

1. Enable p99 stragglers; run **Compare** (S1 vs S2 vs S3).
2. Observe S1 tail explode; S2 tail tracks slowest SSD; S3 tail can show aggregator congestion if many files in flight.
3. Open Heatmap: see build‑ups on specific SSDs; click a timeout in Runbook to jump to that moment in Timeline.

**Acceptance**

* Increasing p99 multiplier increases p99 latency monotonically across solutions.
* Injected timeout count in Results equals sampled failures in Event Log.
* With many concurrent files, S3 shows visible queueing at the aggregator SSD (heatmap lane) while S2’s host lane shows extra reduction time.

---

### **Phase 4 — Calibration (log‑derived) + confidence**

**Goal**
Tie the simulator to observed exerciser data; surface **confidence bands**.

**Scope**

* **Scenario Builder additions:**

  * **Calibration import** (paste or file) → parse exerciser logs.
  * **Profile save/load** (by device/firmware).
* **Model fitting:**

  * Infer per‑4 KiB μ/σ (compute) and command overheads from logs; map exerciser flags ↔ UI knobs (QD, Threads, Read+ NLB, etc.).
  * Store as **Calibration Profile**; apply to scenarios.
* **Results:**

  * KPIs display **± confidence** shaded bands derived from input σ and sample size.
  * Assumptions panel lists fitted parameters and any low‑confidence warnings.

**E2E demo**

1. Import a known log; select “Apply profile”.
2. Run S2 with the matching knobs; KPIs align within your set tolerance window.
3. Toggle profile off → observe KPIs revert to defaults.

**Acceptance**

* For a “mirror” scenario, KPIs fall within a **tolerance** (e.g., ±10–15%) set in Settings.
* Profile round‑trips (save → reload → apply) preserve fitted parameters bit‑for‑bit.

---

### **Phase 5 — What‑If Sweeps + advisor hints + distributions**

**Goal**
Enable quick exploratory analysis and prescriptive hints.

**Scope**

* **What‑If Sweeps:** pick one knob (e.g., Stripe Width 4→32, Objects in Flight 1→N, Chunk Size sweep) and plot trends for each solution.
* **Distributions view:** latency PDF/CDF; per‑SSD boxplots.
* **Advisor:** textual hints (e.g., “S3 wins by 23% at 16 drives; aggregator becomes a hotspot above 24 drives with ≥8 files in flight. Consider round‑robin aggregator.”).

**E2E demo**

1. Sweep Stripe Width 4→32 in **Compare**; see break‑even points where S3 overtakes S2 by margin; advisor explains why.
2. Export sweep results (CSV) and open Distributions to inspect tail behavior per setting.

**Acceptance**

* Sweep runs are reproducible with the same random seed.
* Advisor never contradicts the KPIs (guard: hints are purely derived from results deltas + thresholds).

---

### **Phase 6 — Polish & production‑readiness**

**Goal**
Ship quality: presets, exports, accessibility, guardrails, docs.

**Scope**

* **Presets:** Baseline, 16× Host Agg, 16× SSD Agg, Stress 32× p99, “Match Exerciser: …” (from profile).
* **Exports:**

  * Scenario (.json with seed and calibration profile ref).
  * Results (.csv for KPIs, distributions, queue traces).
  * **Snapshot** (frozen read‑only bundle of scenario + key plots).
* **Validation & guardrails:** MDTS/Read+NLB checks; warnings for high SSD counts without calibration; invalid combos caught with precise messages.
* **Accessibility & performance:** keyboard navigation; render budget for 10–100k commands/s with streaming updates.
* **In‑product help:** concise “How the latency is computed” per solution.

**Acceptance**

* Presets render without warnings; exports re-import cleanly.
* A11y checks pass (focus order, ARIA where applicable).
* Stress runs do not drop frames or stall the UI beyond the defined render budget.

**Status:** ✅ Live — preset library (baseline/16×/stress/match exerciser), CSV + snapshot exports, guardrails, accessibility polish, and in-product latency help are implemented.

---

## 3) Knobs that are **live** per phase

* **Phase 1:** Stripe Width, File Size, Chunk Size, Objects in Flight (1), Queue Depth (per‑SSD), Host aggregation constants (c0,c1,c2), MDTS display, Preset.
* **Phase 2:** + Solution selector (S1/S2/S3), Aggregator policy (S3), SSD aggregation constants (d0,d1).
* **Phase 3:** + Distribution (μ,σ), Straggler p95/p99 multipliers, Failure rate & retry policy, Compare mode.
* **Phase 4:** + Calibration import/profile; “Use profile defaults” toggle.
* **Phase 5:** + Sweep control (knob, start/stop/step), Advisor on/off, Distributions view.
* **Phase 6:** + Preset library, Export formats, Snapshot.
* **Phase 7:** + Stripe Map Source, Access Order, Read+NLB (guarded by MDTS), Aggregator policy: least‑loaded; Derived KPIs (Host CPU %, PCIe control‑traffic), Critical Path formula tooltip.

---

## 4) KPI formulas (display‑level, not code)

* **S1 (Serial seeded):**
  Latency ≈ *pipeline fill* + steady‑state stages; simulator reports the **conservative** (larger) of the two, including retries if present.
* **S2 (Parallel + Host):**
  Latency ≈ `max_i(Ti)` + `Agg_host(x)` + orchestration overhead.
  `Agg_host(x) = c0 + c1·x + c2·log2(x)` (length effects folded into `c1`).
* **S3 (Parallel + SSD):**
  Latency ≈ `max_i(Ti)` + `Agg_ssd(x)` + orchestration overhead.
  `Agg_ssd(x) = d0 + d1·x`, plus queueing at the **aggregator SSD**.

*Critical‑path attribution* shows the percentage of time in SSD compute/queue vs aggregation vs orchestration.

---

## 5) Validation tracks (always‑on)

* **Golden micro‑scenarios:**

  * Single SSD, single chunk → latency ≈ μ (± tolerance).
  * 8 SSDs, equal chunks, no jitter → latency ≈ individual μ plus aggregation cost.
  * S3 pinned aggregator with many files → aggregator heatmap lane shows queue buildup.
* **Calibration mirror:**
  For a known exerciser run, simulated KPIs within the configured tolerance; show **confidence band** width in the KPI header.

---

## 6) Risks & mitigations

* **Calibration misfit** → show confidence bands, surface fitted μ/σ, allow manual overrides with explicit “uncalibrated” banner.
* **Aggregator hotspot modeling** → start with single‑lane FIFO per SSD; if traces disagree, add a second order term guarded by a profile flag.
* **User error (invalid combos)** → pre‑submit validation with actionable fixes (e.g., “Chunk Size 2 MiB exceeds MDTS 1 MiB → auto‑split into 2 commands”).

---

## 7) Tracking plan (minimal)

* `enterprise.run.clicked` (solution, mode, seed, profile\_id)
* `enterprise.scenario.exported` / `results.exported` (counts, sizes)
* `enterprise.compare.used` (solutions\_selected)
* `enterprise.calibration.imported` (device\_family, stats\_extracted)
* `enterprise.warning.shown` (type: mdts\_clamp | aggregator\_hotspot | calibration\_low\_confidence)

---

## 8) Definition of Done (per phase)

* **Always:** (a) user can run a scenario, (b) see KPIs, (c) see at least one visualization, (d) export something, (e) reproduce with the same seed.
* **Phase‑specific DoD** listed in each phase’s *Acceptance* section above.

---

## 9) Rollout & isolation

* New route `/enterprise` behind a **feature flag**.
* **Isolated state slice** (no shared mutable state with other tabs), read‑only import from “Data Distribution” for optional stripe maps.
* No code paths from existing tabs are touched; Enterprise tab can be disabled without side‑effects.

---

### TL;DR

* **Phase 1 ships a working simulation** (S2, deterministic) with KPIs and a Gantt timeline.
* **Phase 2 adds S1 & S3** and the Aggregation Tree; still deterministic.
* **Phase 3 brings reality** (jitter, failures) plus **Compare** and the Heatmap.
* **Phase 4 calibrates** to logs with confidence bands.
* **Phase 5 unlocks sweeps** and an advisor.
* **Phase 6 polishes** with exports, presets, and accessibility.

Each phase is a **complete E2E flow** that the user can run and visually verify.

---

## Implementation Review — Enterprise Simulator (as built)

Summary

- Core engine and UI for S1/S2/S3 are implemented with MDTS splitting, queue depth, stochastic service times, retries, and event/runbook logging.
- Compare and What‑If Sweep modes exist with advisor hints, CSV exports, and snapshot export.
- Calibration import (paste/file) is wired with profile save/load and confidence interval display in KPIs.
- Integrated within `CRCWorkflowVisualizer` as an “Enterprise” view; library code lives under `lib/enterprise/*`.

What’s Aligned (by plan phase)

- Phase 1: S2 end‑to‑end with KPIs + timeline. Deterministic mode supported via `serviceDistribution = 'deterministic'`.
- Phase 2: S1 and S3 added; aggregator policy supports pinned and round‑robin; Aggregation Tree is rendered.
- Phase 3: Jitter, stragglers, and failures implemented; Compare mode, Queue Heatmap, and Failure Runbook present.
- Phase 4: Calibration parser and profiles implemented; KPIs show CI margins derived from calibration/sample counts.
- Phase 5: What‑If sweeps (several knobs) + Advisor hints; sweep CSV export.
- Phase 6: Presets, exports (scenario, results, snapshot) and guardrails exist; basic a11y labels and performance guards (segment aggregation) are present.

Gaps & Divergences

- Placement & Isolation
  - Implemented as a mode inside `CRCWorkflowVisualizer` rather than a dedicated `/enterprise` route behind a feature flag.
  - State is mostly isolated, but route‑level isolation and feature flag are not present.
- Aggregator policy
  - Only `pinned` and `roundRobin` are implemented; `least‑loaded` policy from the spec is not available.
- Knobs not yet surfaced
  - PCIe Gen/Lanes and host CPU estimate are not modeled or exposed.
  - Read+NLB is only used for validation/warnings via calibration, not as a live knob.
  - Stripe map source (Uniform vs Imported from Data Distribution) and Access Order (stripe vs randomized) not implemented.
- KPI coverage
  - No Host CPU estimate or PCIe control‑traffic estimates in KPI header.
  - Critical‑path overlays exist, but no explicit “critical path formula” tooltip beyond the text hints.
- Calibration/CI details
  - CI computation uses a normal approximation on simulated object latencies and scales from calibration sample counts; it’s reasonable but not explicitly tied to per‑percentile empirical variance. Consider per‑percentile bootstrapping when calibration samples are large.
- Validation & guardrails
  - Good MDTS/queue checks present. Could add more proactive guidance when QD is a bottleneck (e.g., suggest QD ≥ objectsInFlight).

Modeling Notes (correctness/quality)

- S1 serial pipeline is modeled as a single global chain; lane occupancy reflects sequential behavior and matches the seeded semantics.
- S2/S3 parallelism uses per‑SSD queues bounded by `queueDepth`; S3 adds an aggregator lane per policy with occupancy tracked per SSD.
- Aggregation costs: S2 uses `c0 + c1·x + c2·log2(x)`; S3 uses `d0 + d1·x`. This aligns with the plan and is exposed as live knobs and via calibration defaults.
- MDTS clamp and segment splitting are applied per chunk with clear UI warnings; derived parameters panel reflects aggregator totals and critical path contributions.

High‑Value Next Steps

- Add least‑loaded aggregator policy and expose it in the UI; show its effect in heatmap and KPIs.
- Introduce “Stripe Map Source” with optional import from Data Distribution; optionally add “Access Order” (stripe vs randomized) to stress cache/queue behavior.
- Add PCIe control‑plane headroom as metadata (Gen/Lanes), and a lightweight Host CPU estimate (even if heuristic) to the KPI header.
- Surface Read+NLB as a live knob (guarded by MDTS) when not using a calibration profile.
  

Validation Suggestions

- Add a “golden micro‑scenario” preset set for S1/S2/S3 and verify p50/p95/p99 monotonicity with controlled jitter.
- Include a quick self‑test for MDTS clamping and queue saturation (e.g., x=8, QD=1 vs QD=32) to catch regressions.

---

### Phase 7 — Aggregator + Stripe Map + Derived KPIs

Goal

- Land the highest‑value knobs and outputs without adding low‑ROI controls. Improve realism and decisionability while keeping the UI focused.

Scope

- Add (high‑value knobs/derived outputs):
  - Stripe Map Source: Uniform | Import from Data Distribution.
  - Access Order: stripe order | randomized (affects queue/jitter exposure).
  - Aggregator Policy: add least‑loaded (choose aggregator lane with lowest end time).
  - Read+NLB knob (1–4) with MDTS guardrails; warn/error on invalid combos.
  - Derived KPIs (no new knobs):
    - Host CPU estimate: approximate core utilization from aggregation time share.
    - PCIe control‑traffic: relative control TLPs per SSD and for aggregator.
    - Critical Path tooltip: formula per solution (concise overlay next to KPIs).

- Out of scope (kept minimal):
  - PCIe Gen/Lanes stays metadata (not a live knob).
  - Threads remains read‑only/calibration‑seeded.
  - CPU frequency knob is avoided; use the CPU estimate heuristic above.

- Modeling updates (lightweight):
  - Least‑loaded aggregator: pick lane with min aggregator cursor; reflect in heatmap; update critical path attribution.
  - Access Order randomized: shuffle per‑stripe submission order to increase queue contention; ensure deterministic under seed.
  - Stripe Map import: accept lane assignment array from Data Distribution tab; fallback to uniform if absent.
  - Host CPU estimate: `CPU% ≈ AggregationTime_total / WallClock_total × 100` (single‑core equivalent), with note that concurrency may saturate multiple cores.
  - PCIe control traffic: `msgs ≈ (2 × commands) + (S3: 2 × stripes per object)`; render as relative bars per SSD/aggregator.

E2E demo

1. Import a stripe map from Data Distribution; toggle Access Order randomized and observe p95 increase under fixed jitter.
2. Switch S3 aggregator to least‑loaded and see aggregator heatmap peak drop vs pinned on multi‑object runs.
3. Increase Read+NLB above MDTS; see guardrail warning/error; reduce to valid range and re‑run.
4. Review KPIs with Host CPU and PCIe control‑traffic estimates; open Critical Path tooltip for formulas.

Acceptance

- New knobs visible and gated appropriately; invalid Read+NLB × MDTS combos blocked with actionable messages.
- Least‑loaded policy reduces aggregator lane peak occupancy vs pinned (same seed/scenario) and updates critical‑path shares.
- Randomized access yields higher p95 vs stripe order under same μ/σ and seed.
- Derived KPIs are shown (Host CPU %, PCIe control traffic) and export with results.
- Compare/Sweep still export; advisor hints remain coherent; no regressions in existing phases.
