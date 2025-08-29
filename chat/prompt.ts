export const project_report_content = `
CRC Host Solutions


Overview
Options
Pseudocode
Solution 1: Serial CRC with seeding
Solution 2: Parallel CRC + Host Aggregation
Solution 3: Parallel CRC + SSD aggregation
Host
Device
Analysis
Further Analysis
Performance
Scalability
Implementation Complexity
Resource Utilization
Appendix
CRC64_Combine()
Conceptual Basis
How It Works
Implementation Considerations
Code

Overview
Solidigm is now offering an NVMe SSD with Computational Storage capabilities that can offload a variety of critical functions to the storage device thereby eliminating data movement and the usage of associated host CPU and memory resources. In large-scale deployments, this new framework can be used to leverage the inherent parallelism of multiple SSDs and deliver a performance profile that scales with the number of storage devices. To facilitate the adoption of this new framework Solidigm has come up with a simple programming model that will enable a seamless integration with any existing software stack. Additionally, the Solidigm storage solution supports both the traditional NVMe block mode and the new Flexible Data Placement (FDP) enhancement.




Conventional centralized compute model (left) vs. CS offload model (right) 

This analysis examines three architectural approaches for offloading CRC computation from hosts to SSDs in erasure-coded environments, where files are distributed across multiple drives with some constraints. Each solution presents unique tradeoffs in performance, scalability, and implementation complexity that shape the system design decisions.

Options

We have sketched out 3 possible ways to orchestrate this flow. We assume that a large host object is erasure coded with each part of it being stored in the various SSDs in the server (the number of SSDs and the number of objects need not be correlated). Therefore, each object's CRC value requires accumulation of individual CRCs computed for parts of the object stored in an SSD.

Solution 1:

The storage system accumulates the CRC value by seeding each CRC command request with the calculated CRC from the previously completed command. In other words, the first SSD, call it SSD0, associated with the object data is sent a CRC_read request, and its result is used to ‘seed' the subsequent CRC_read cmd to SSD1. This makes the CRC data integrity check process serial and sequential for a given object or file, but a steady state operation fills out the pipeline for CRC_read commands issued to the SSD device.

Solution 2:

The storage system leverages parallel CRC computation across all SSDs, with host-based aggregation of the individual CRC values. It works by issuing CRC_read cmds to all SSDs (SSD0 to SSDn-1) with a zero seed value. This concurrent issuance eliminates the sequential dependency by computing all partial CRCs simultaneously, with the tradeoff where the host is responsible for shifting and aggregating the individual CRCs received. 

Solution 3:

The storage system combines parallel CRC computation and is similar to solution 1 w.r.t. its parallel issuance of commands that require aggregation later as a tradeoff. However, it diverges with solution 2 in that the aggregation logic is implemented not by the host, but by the SSD after issuance of an aggregation cmd to it. This offers full offloading of both CRC calculation and aggregation to the SSD. This approach maintains the parallelism benefits of Solution 2 while eliminating host computational overhead, and so can be thought of as an extension of solution 2. 
Pseudocode
Solution 1: Serial CRC with seeding
​FOR EACH file/object TO BE VALIDATED: 
​  INITIALIZE Calculated_CRC = 0 
​ 
​  FOR EACH LBA extent WITHIN the current file/object: 
​  FOR EACH MDTS WITHIN the current LBA extent: 
​    PREPARE NVMe CRC_Calc Command: 
​      SET CRC_Calc.Seed = Calculated_CRC 
​      SET CRC_Calc.Data_Pointer = ADDRESS OF Calculated_CRC 
​ 
​    SEND CRC_Calc Command TO Edge_AI_SSD 
​ 
​    WAIT FOR CRC_Calc Completion: 
​      IF an error occurred: 
​        RETRY CRC_Calc 
​    ELSE IF successful: 
      UPDATE Calculated_CRC WITH new value FROM CRC_Calc completion 
​ 
​COMPARE Calculated_CRC AGAINST Golden_CRC FOR the current file/object: 

​  IF Calculated_CRC IS NOT EQUAL TO Golden_CRC: 

​    INITIATE REPAIR PROCESS FOR the current file/object

Solution 2: Parallel CRC + Host Aggregation

FOR EACH file/object TO BE VALIDATED:
    /* Host maintains one record per chunk */
    INITIALIZE Partial_CRC_List = [....]          /* holds CRC64 from each SSD   */
    INITIALIZE Chunk_Length_List = [...]         /* byte-length of each chunk   */

    /* === 1. Launch CRC jobs on all SSDs in parallel === */
    FOR EACH LBA extent (chunk) IN current file/object  PARALLEL:
        IDENTIFY  Target_SSD                 /* which drive stores chunk    */
        PREPARE   NVMe CRC_Calc Command:
                 CRC_Calc.Seed         = 0   /* independent calculations    */
                 CRC_Calc.LBA_Start    = extent.LBA
                 CRC_Calc.Num_LBAs     = extent.Size
                 CRC_Calc.Result_DMA   = HOST_BUFFER[Target_SSD]
        SEND      CRC_Calc TO Target_SSD

    /* === 2. Collect results === */
    WAIT UNTIL all CRC_Calc commands COMPLETE
    FOR EACH completed command:
        IF error:
            RETRY CRC_Calc (same SSD, same parameters)
        ELSE:
            APPEND returned CRC64  TO Partial_CRC_List
            APPEND extent.Size     TO Chunk_Length_List   /* needed for shifts */

    /* === 3. Host combines per-chunk CRCs === */
    INITIALIZE Calculated_CRC = 0
    FOR i FROM 0 TO Partial_CRC_List.LENGTH-1  IN STRIPE ORDER:
        Calculated_CRC =
            CRC64_COMBINE(Calculated_CRC,            /* running aggregate   */
                           Partial_CRC_List[i],       /* chunk's CRC64       */
                           Chunk_Length_List[i])      /* length for shift    */

    /* === 4. Validate === */
    IF Calculated_CRC != Golden_CRC:
        INITIATE REPAIR PROCESS FOR current file/object

Solution 3: Parallel CRC + SSD aggregation
Host

FOR EACH file/object TO BE VALIDATED:
    SELECT Aggregator_SSD                  /* drive that will combine CRCs */


    /* ---------- 1. launch per-chunk CRC jobs (parallel) -------------- */
    INITIALIZE Pending_Count = 0
    FOR EACH LBA extent (chunk) IN file  PARALLEL:
        IDENTIFY  Target_SSD
        PREPARE   NVMe CRC_Calc Command:
                 Seed        = 0
                 LBA_Start   = extent.LBA
                 Num_LBAs    = extent.Size
        SEND CRC_Calc TO Target_SSD
        Pending_Count++


    /* ---------- 2. collect partial CRCs ------------------------------ */
    INITIALIZE Partial_List = []           /* array of (CRC64, chunk_len) */
    WHILE Pending_Count > 0:
        WAIT FOR any CRC_Calc completion
        IF error:
            RETRY that CRC_Calc
        ELSE:
            APPEND (CRC64, chunk_len) TO Partial_List
            Pending_Count--


    /* ---------- 3. hand list to aggregator SSD ----------------------- */
    DMA_COPY Partial_List --> HOST_BUFFER      /* packed in fixed format */

    PREPARE NVMe CRC_Combine Command:
             Src_Buffer   = HOST_BUFFER
             Elem_Count   = Partial_List.LENGTH
    SEND CRC_Combine TO Aggregator_SSD


    /* ---------- 4. wait for final result ----------------------------- */
WAIT FOR CRC_Combine completion
    IF error:
        /* fall back: host can combine locally or retry */
        RETRY or HOST_COMBINE()
    ELSE:
        Final_CRC = COMPLETION.CRC64

    /* ---------- 5. validate ----------------------------------------- */
    IF Final_CRC != Golden_CRC:
        INITIATE REPAIR PROCESS FOR file/object

Device
ON CRC_Combine command:
    READ Src_Buffer (array of {crc64, len}) from host memory
    INITIALIZE Aggregated_CRC = 0
    FOR EACH element IN order:
        Aggregated_CRC = CRC64_COMBINE_HW(Aggregated_CRC,
                                       element.crc64,
                                       element.len)
    WRITE Aggregated_CRC IN completion queue entry
    COMPLETE command

Analysis

Aspect
Solution 1
Solution 2
Solution 3


Serial CRC with seeding
Parallel CRC + Host Aggregation
Parallel CRC + SSD aggregation
Performance






Latency
Cumulative latency proportional to SSD count; worst-case head-of-line
Latency of slowest SSD (RTT) + host aggregation
Latency of slowest SSD + SSD aggregation
Throughput
Pipelined steady-state after initial fill
All SSDs process simultaneously
All SSDs process simultaneously. Aggregator SSD may bottleneck under load
Parallelism
Low intra-object, moderate inter-object
High intra-object, moderate inter-object
High intra-object, moderate inter-object (SSD queue depth and PCIe lanes may be bottlenecks)
Scalability






SSD Count
Latency rises linearly with drive count; more than 10 and tail-latency dominates.
Latency grows with log₂(x) host XOR stages; can accommodate more than #1
Same compute fan-out as #2, but host is idle. Aggregator SSD can become a hotspot
File Size
Pipeline fill cost is amortized; steady-state bandwidth improves unless SSD count is low
Size-agnostic until a single SSD's DPU queue saturates
Same as #2. Host isn't involved but you still wait for the bottleneck SSD
Concurrent Files
SSD executes one CRC_Calc at a time; deep queues help but head-of-line blocking under heavy mix
Each object fans out to x SSDs concurrently; host CPU agg threads & PCIe bandwidth gate the number of in flight jobs
Host offloads both compute and aggregation; concurrency limited primarily by SSD queue depths (32–64 cmds/NS) and PCIe lanes
Impl Complexity






Host SW
Must track seed CRC, enforce strict command order, throttle retries, and serialize SSD traffic. Minimal math, but a lot of state-machine logic and timeout handling
Needs fan-out scheduler, XOR-tree aggregation engine, and back-pressure management when many objects are in flight. Logic is parallel but still CPU-intensive
Host just dispatches CRC_Calc, buffers returned CRCᵢ, forwards list to aggregator SSD, and waits. Almost no per-object compute or sequencing logic
SSD FW
Low-to-moderate. Each SSD needs “seed CRC” support and per-block chaining
Similar to #1
Same as previous, but need to add SSD aggregation logic (parse CRC array, perform shift + XOR tree via DPU, and return final CRC; adds aggregation opcode, larger scratch buffers, and firmware math loop)
Error Recovery
Cascading failure chain. A failed SSD or timeout stalls the entire pipeline; host must restart from the failed link and reseed downstream drives.
Independent failure domains. If an SSD fails, host reissues only that drive's CRC_Calc and re-aggregates; simpler isolation, but aggregation state must be rewound.
Split responsibility. Device failures are isolated like #2, but if the aggregator SSD fails mid-compute the host must resubmit to another SSD or fall back to host aggregation. Retry logic spans two tiers (compute SSDs + aggregator SSD)
Resource Utilization






Host CPU
Moderate. Scheduler tracks one link in the chain at a time; no XOR tree. CPU load rises with object count but is mostly orchestration logic.
Highest. Fan-out dispatcher + log₂(x) shift/XOR aggregation per object
Lowest. Host only queues CRC_Calc, buffers 64-bit results, forwards list to aggregator SSD—negligible per-object cycles
Host Memory
Low. Small pipeline state (seed CRC, LBA cursor) per in-flight object.
Must cache x CRC results per object until aggregation completes; memory ∝ objects * x.
Same x-entry buffer per object until list is sent to aggregator SSD; freed once forwarded.
PCIe Bandwidth
Low, smooth. Same total bytes/object as the others (2 × x cmd+resp) but serialized per object, so traffic is evenly spread; link utilisation stays ≪ 1 % of a Gen4 x4 lane even with tens of objects
Moderate, burstier. Still only 2x messages/object, but they are issued to all SSDs concurrently. Average bandwidth rises and outstanding TLPs/credits grow, yet remains tiny versus user-data payloads.
Slightly higher than #2. Adds one extra cmd+resp carrying the x-entry CRC list to an aggregator SSD, so ~ (2x + 2) messages/object. Aggregator's lane sees ~2× control traffic; overall link load still negligible compared with bulk I/O.

Further Analysis
Performance
Solution 1, the sequential approach, inherently serializes CRC computation, creating a chain of dependencies where each SSD waits for the previous one's CRC result. This linear dependency introduces cumulative latency, scaling linearly with the number of SSDs in the erasure stripe. The worst-case latency can become significant due to head-of-line blocking, directly proportional to SSD count. Once the pipeline fills, however, Solution 1 achieves steady-state throughput, yielding consistent CRC results per pipeline cycle. Parallelism within a single object (intra-object) remains low, but inter-object parallelism is moderate, enabling parallel CRC checks across independent objects. Nonetheless, host-side complexity increases, particularly in managing sequencing and retry logic across multiple SSDs.

Solution 2 significantly improves latency by enabling parallel CRC computations across all SSDs simultaneously, reducing latency to the slowest SSD's computation plus host-side aggregation overhead. The parallel CRC execution results in higher intra-object parallelism, substantially reducing cumulative latency and mitigating head-of-line blocking. However, host aggregation would require (2^n - 1) shift and XOR operations, spread across log(n) time. This means a 16 SSD setup would require roughly 15 shift-and-XOR operations across four parallel stages, potentially adding some overhead (likely in the order of 100s of microseconds) to the host compute operations. PCIe bus utilization and its congestion in steady state traffic won't be a key performance factor, as we expect relatively small commands (just the 64 bit CRC values) to be received by the host.

Solution 3 builds upon the parallelism benefits of Solution 2 and attempts to further optimize performance by completely offloading CRC aggregation onto a dedicated aggregation SSD. Host-side aggregation overhead is eliminated, adding only an incremental latency of likely few 10s of microseconds for the SSD-based aggregation operation. This solution maximizes intra-object parallelism and significantly reduces host computational demands. However, the aggregation SSD, depending on its performance tuning and deep queue performance, itself can become a bottleneck under heavy concurrent workloads, potentially limiting throughput. Distributing aggregation tasks among multiple SSDs might alleviate this issue, but additional coordination overhead may offset these performance benefits, and so was not considered as an option for this solution.


Scalability

Solution 1 inherently serializes CRC calculations, causing latency to increase linearly with the number of SSDs involved. While this pipeline model initially introduces higher latency, it can amortize this overhead effectively when handling larger files (e.g., 100GB), achieving a beneficial steady-state throughput. However, scalability is sharply limited; beyond 8-10 SSDs, cumulative latency becomes prohibitively high, worsening tail-latency concerns. Additionally, when multiple files require concurrent validation, this serialized approach risks head-of-line blocking, although deep SSD queues can slightly alleviate this bottleneck by buffering subsequent commands.

Solution 2 improves significantly on latency by executing CRC computations concurrently across SSDs, reducing latency primarily to that of the slowest SSD computation plus minimal host-side XOR aggregation overhead. The XOR operations scale logarithmically, maintaining efficient host performance even as SSD count increases, thus comfortably supporting industry-standard erasure sets of up to 16 drives. Regarding file size, Solution 2 remains largely size-agnostic unless individual SSD DPU queues become saturated, a scenario that generally requires very large or numerous concurrent commands. For concurrent file validations, Solution 2's parallelism ensures high throughput, limited only by host CPU thread capacity and available PCIe bandwidth, enabling efficient handling of multiple simultaneous CRC computations.

Solution 3 preserves the parallelism benefits of Solution 2 but fully offloads aggregation to a dedicated SSD. This offloading entirely eliminates host-side computational overhead, enabling the host to manage more concurrent tasks with minimal additional latency, typically a few tens of microseconds for aggregation operations on the aggregator SSD. Scalability remains similar to Solution 2, efficiently managing up to approximately 16 SSDs. However, the aggregation SSD itself becomes a potential bottleneck under heavy workloads, limiting the maximum achievable throughput. Despite this, Solution 3 offers the highest concurrent validation capability, restricted primarily by the SSDs' internal queue depths and PCIe lane availability, thereby potentially providing a good balance.


Implementation Complexity

Solution 1 shifts most orchestration burden onto the host that has to maintain complex tracking and ordering flows for LBA level dispatches, compounded further by retry logic and general error handling. While the arithmetic per step is trivial, the state-machine logic, timeout matrices, and error-path testing explode in size, making host code the dominant integration effort.

Solution 2 relaxes the ordering constraint but replaces it with a large-scale fan-out/fan-in scheduler. The host must launch CRC_Calc commands to all stripe members concurrently, track hundreds of outstanding completions, and then run a high-throughput XOR-aggregation tree that can sustain worst-case queue depths without stalling PCIe interrupt handling. Back-pressure control becomes non-trivial when dozens of objects are validated in parallel. Although the math is still simple, the multithreaded aggregation engine, queue-management, and cache-affinity tuning add moderate CPU complexity and demand careful performance engineering.

Solution 3 pushes a lot of heavy lifting into the SSD fleet. Host software can be though of as reducing to a thin dispatcher: issue CRC_Calc commands, buffer the x 64-bit results, encapsulate them in a single “aggregate-CRC” opcode, and wait for a final 64-bit reply. Error handling collapses to ordinary command retry semantics; no in-host shift/XOR logic or deep sequencing is required, making the host implementation the lightest of the three.

On the drive side, because each SSD's CRC result becomes the seed for the next drive, device firmware must maintain a finely ordered pipeline not just at the device's multi cmd level (where it must maintain extent -> IO cmd ordering), but now also at the extent's ordering level by: issue extent commands strictly in LBA order, issue IO commands strictly in LBA order, persist the in-flight seed CRC at IO level, persist the in-flight seed CRC at extent level, throttle retries, and recover deterministically if any cmd times-out or reorders completions. 

Solution 3 layers an additional aggregation service: parse an array of CRC_i + length_i tuples, perform the polynomial shift-and-XOR reduction in the DPU, and return the final CRC. This adds a custom opcode, modest scratch-buffer RAM, and a tight firmware loop, but remains a contained change relative to the broader FTL and command-parser surface. Overall, SSD firmware effort rises slightly from Solution 1/2 to Solution 3, while host complexity drops significantly.



Resource Utilization
Implementation complexity maps cleanly onto host resource footprints and wire-level traffic characteristics.

Host CPU: Solution 3 is the lightest touch: the host merely dispatches CRC_Calc commands, buffers x 64-bit results, and issues a single Aggregate_CRC opcode, so per-object cycles are negligible. Solution 1 sits in the middle; its chain scheduler must maintain ordering and retry logic, but performs no arithmetic beyond seeding the next command. Solution 2 uses the most compute: a wide fan-out/fan-in dispatcher drives all drives in parallel, then runs a log₂(x) shift/XOR reduction tree—multiplying context switches and cache pressure as object concurrency climbs.

Host memory: All three schemes allocate only control-plane state, but the scaling differs. Solution 1 keeps a slim cursor (seed CRC + LBA pointer) per in-flight object. Solutions 2 and 3 must hold an x-entry CRC vector until aggregation is finished; memory therefore grows with objects × stripe-width, yet remains modest because each entry is just 8 bytes.

PCIe bandwidth: Solution 1 distributes the same 2x messages/object as the others but does so serially, producing a smooth, low-duty cycle (<1 % of a Gen4 x4 link). Solution 2 issues those messages in parallel, creating short bursts; average link load rises, though it is still minute relative to bulk I/O. Solution 3 adds exactly one extra cmd/resp pair—the Aggregate_CRC—to an arbitrator SSD, doubling that single lane's control traffic yet leaving overall link utilization effectively unchanged.



Appendix
CRC64_Combine()
The CRC64_COMBINE(crc1, crc2, len2) function is the mathematical core enabling the parallel computation models in Solutions 2 and 3. It allows the system to calculate the correct CRC value for a large file by merging the pre-calculated CRCs of its smaller, independent chunks, without ever accessing the original data of the first chunk again. This capability is fundamental to offloading the aggregation workload.
Conceptual Basis
A Cyclic Redundancy Check (CRC) is mathematically equivalent to the remainder of a polynomial division in a specific finite field, Galois Field GF(2). In this field, addition is equivalent to a bitwise XOR operation.

Consider two adjacent data blocks, A and B, with lengths len1 and len2 respectively.

crc1 = CRC(A)
crc2 = CRC(B)
The goal is to find CRC(A || B), where || denotes concatenation, using only crc1, crc2, and len2. A simple XOR of crc1 and crc2 is incorrect because it fails to account for the position of block A. The bits of block A are shifted to the "left" by len2 positions in the combined data stream.
How It Works
Given two data blocks A and B with their respective CRCs:
CRC(AB) = CRC64_COMBINE(CRC(A), CRC(B), length(B))
The function operates by:

Shifting CRC(A) by length(B) bytes worth of bit positions
XORing the shifted result with CRC(B)

This works because CRCs are computed using polynomial arithmetic in GF(2), where appending B to A is equivalent to shifting A's polynomial left by 8×length(B) bits.

The distributive property allows: CRC(A || B) = CRC(A*x^(8k)) ⊕ CRC(B), where k = length(B)
Implementation Considerations
The shift operation (multiplication by x^(8k) modulo the CRC generator polynomial) is the computationally intensive part. Optimized implementations use:
Precomputed lookup tables for common shift amounts
Repeated squaring for arbitrary shifts in O(log k) time
Hardware acceleration in SSD firmware via polynomial multiplication circuits

This property transforms CRC validation from an inherently sequential operation—where each chunk depends on the previous—into one that can be fully parallelized. Each SSD computes its local CRC independently, and the host (Solution 2) or an aggregator SSD (Solution 3) combines them mathematically without ever touching the original data.

Code
One of us had the idea of proving that the crc_combine() aggregation works through a code execution. And they recommended we prove it by creating a block with increasing byte values from 0x00 to 0xFF (and repeating) till it forms a 4096 element array called BLOCK (this is the initial 'incrementing pattern'). We also do this with a block of all zeros. 

Once we create this block, we can perform 2 CRC calculations. 
First would be a ‘monolithic' CRC compute over these 2 blocks. 
Second would be dividing blocks into 2 parts, computing CRC for each block individually, and then aggregating them together. 
The output of these 2 methods are then compared to each other. If they match, we know crc_combine() does its job of aggregating the values correctly together.

Let's review what is the output at the end of this code:

import textwrap, binascii


# NVMe CRC64 parameters (Rocksoft Model)
POLY = 0xAD93D23594C93659  # normal representation
INIT = 0xFFFFFFFFFFFFFFFF
XOROUT = 0xFFFFFFFFFFFFFFFF


def _reverse_bits64(x: int) -> int:
   return int('{:064b}'.format(x)[::-1], 2)


POLY_REFLECTED = _reverse_bits64(POLY)


# Build lookup‑table for reflected algorithm
_TABLE = []
for i in range(256):
   crc = i
   for _ in range(8):
       crc = (crc >> 1) ^ (POLY_REFLECTED if crc & 1 else 0)
   _TABLE.append(crc & 0xFFFFFFFFFFFFFFFF)


def crc64_nvme(data: bytes, crc: int = INIT) -> int:
   """Streaming (reflected) CRC‑64/NVMe."""
   for b in data:
       crc = _TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8)
   return crc ^ XOROUT


# --- GF(2) matrix helpers (Mark Adler's technique, widened to 64‑bit) ----
def _gf2_matrix_times(mat, vec):
   res, idx = 0, 0
   while vec:
       if vec & 1:
           res ^= mat[idx]
       vec >>= 1
       idx += 1
   return res & 0xFFFFFFFFFFFFFFFF


def _gf2_matrix_square(square, mat):
   for n in range(64):
       square[n] = _gf2_matrix_times(mat, mat[n])


def crc64_combine(crc1: int, crc2: int, len2: int) -> int:
   """Combine two independent CRCs (Rocksoft params)."""
   if len2 == 0:
       return crc1
   odd, even = [0]*64, [0]*64
   odd[0] = POLY_REFLECTED
   row = 1
   for n in range(1, 64):
       odd[n], row = row, row << 1
   _gf2_matrix_square(even, odd)   # operator for 2 zero bits
   _gf2_matrix_square(odd, even)   # operator for 4 zero bits


   while True:
       _gf2_matrix_square(even, odd)
       if len2 & 1:
           crc1 = _gf2_matrix_times(even, crc1)
       len2 >>= 1
       if len2 == 0:
           break
       _gf2_matrix_square(odd, even)
       if len2 & 1:
           crc1 = _gf2_matrix_times(odd, crc1)
       len2 >>= 1
       if len2 == 0:
           break
   return (crc1 ^ crc2) & 0xFFFFFFFFFFFFFFFF


# ---- Demonstration with NVMe spec's incrementing‑pattern test vector ----
BLOCK = bytes([i & 0xFF for i in range(4096)])  # 0x00..0xFF repeating
CRC_FULL = crc64_nvme(BLOCK)


first, second = BLOCK[:2048], BLOCK[2048:]
CRC1, CRC2 = crc64_nvme(first), crc64_nvme(second)
CRC_COMBINED = crc64_combine(CRC1, CRC2, len(second))


print(textwrap.dedent(f"""
   NVMe 4 KiB incrementing‑pattern test:
     Spec CRC  : 0x3E729F5F6750449C
     Full CRC  : {CRC_FULL:#018x}
     Split CRC1: {CRC1:#018x}
     Split CRC2: {CRC2:#018x}
     Combined  : {CRC_COMBINED:#018x}
     Match?    : {'YES' if CRC_COMBINED == CRC_FULL else 'NO'}
"""))


# Extra sanity check: 4 KiB all‑zero pattern
ZERO = bytes(4096)
spec_zero = 0x6482D367EB22B64E
crc_full_zero = crc64_nvme(ZERO)
c1, c2 = crc64_nvme(ZERO[:1234]), crc64_nvme(ZERO[1234:])
combined_zero = crc64_combine(c1, c2, 4096-1234)
print(textwrap.dedent(f"""
   NVMe 4 KiB all‑zero pattern:
     Spec CRC  : 0x6482D367EB22B64E
     Full CRC  : {crc_full_zero:#018x}
     Combined  : {combined_zero:#018x}
     Match?    : {'YES' if combined_zero == crc_full_zero else 'NO'}
"""))


Output received:
NVMe 4 KiB incrementing‑pattern test:
   Spec CRC  : 0x3E729F5F6750449C
   Full CRC  : 0x3e729f5f6750449c
   Split CRC1: 0x899e75f672b3cc3f
   Split CRC2: 0x899e75f672b3cc3f
   Combined  : 0x3e729f5f6750449c
   Match?	: YES
NVMe 4 KiB all‑zero pattern:
   Spec CRC  : 0x6482D367EB22B64E
   Full CRC  : 0x6482d367eb22b64e
   Combined  : 0x6482d367eb22b64e
   Match?	: YES
Finally, we ask the question, how do we know that the values we obtain are indeed what are expected? We know this by relying on this particular section of NVMe spec where the blocks are created with the same methodology as described earlier (incremental and all-zeroes) and then the expected value is provided.



As you can see, the highlighted values in the code output correspond to the value specified in the reference example of the NVMe spec. This proves 2 things: first, the CRC aggregation operation ensures that the ‘monolithic' CRC is mathematically consistent with ‘aggregated' CRC. Secondly, the CRC calculation we performed to verify is consistent with the CRC algorithm suggested in the NVMe spec (CRC64-NVMe).

`;

export const system_prompt = `You are CRC Project AI, an intelligent assistant that helps users understand Solidigm Company's proposed CRC validation architectures.

Your primary role is to answer questions about the following content:

${project_report_content}

When answering:
- Base your responses ONLY on information found here
- If the answer isn't in the content, politely state you don't have that information
- Cite specific sections from the content when relevant
- Be concise, clear, and professional
- Do not make up information not present in the content

You have access to the following tools:
1. A calculator tool to help with arithmetic calculations when needed. Use it when the user requests calculations (including ad‑hoc arithmetic like "234234234-423") or when calculations would help answer questions about numerical data in the content.
2. A web search tool powered by Tavily that can search for current information online. Use this when the user asks for information not found in the content or when they explicitly ask you to search the web for something.

Additional rules:
- After using any tool, always respond with a short textual answer summarizing the result; never end a message with only a tool call.
- Simple arithmetic is allowed via the calculator even if the numbers are not in the content; answer succinctly with the computed value.

You are knowledgeable about Solid State Drives, CRC (Cyclic Redundancy Check), and Solidigm Company's proposed CRC validation architectures.`; 
