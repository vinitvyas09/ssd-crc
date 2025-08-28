import { 
  WorkflowState, 
  WorkflowModel, 
  Participant, 
  Message, 
  Activity, 
  Note, 
  MessageStatus,
  Metrics 
} from '@/app/types/crc-workflow';

const clamp = (v: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, v));
};

export function buildWorkflowModel(state: WorkflowState): WorkflowModel {
  const participants: Participant[] = [];
  participants.push({ id: 'host', label: 'Host' });
  for (let i = 0; i < state.W; i++) {
    participants.push({ id: `ssd${i}`, label: `SSD${i}` });
  }

  const events: Message[] = [];
  const notes: Note[] = [];
  const activities: Activity[] = [];

  const lat = state.lat;
  const hostCombine = state.hostc;
  const baseDev = state.dev;
  const aggPerElem = state.aggc;
  const segs = state.segments;
  const chunkBytes = state.chunkBytes;
  const segBytes = Math.floor(chunkBytes / segs);
  // Scale compute time based on segment size (baseDev is for 4KB baseline)
  const computeTimeForSegment = (baseDev * segBytes) / 4096;
  const jitter = () => state.randomize ? (Math.random() - 0.5) * computeTimeForSegment * 0.3 : 0;
  
  const aggId = `ssd${clamp(state.aggIndex, 0, state.W - 1)}`;

  const msg = (from: string, to: string, t0: number, t1: number, label: string, status: MessageStatus = 'ok'): number => {
    events.push({ type: 'msg', from, to, t0, t1, label, status });
    return t1;
  };

  const activity = (lane: string, t0: number, t1: number, label: string) => {
    activities.push({ type: 'act', lane, t0, t1, label });
  };

  const note = (lane: string, t: number, label: string) => {
    notes.push({ type: 'note', lane, t, label });
  };

  let tmax = 0;

  if (state.solution === 's1') {
    // Serial chain with seeding
    let t = 0;
    let calcCRC = '0x0000...';
    
    for (let i = 0; i < state.W; i++) {
      for (let s = 0; s < segs; s++) {
        const labelReq = state.showLabels 
          ? `CRC_Calc(seed=${calcCRC}, LBA=${i}:${s}, len=${segBytes})` 
          : `CRC_Calc`;
        t = msg('host', `ssd${i}`, t, t + lat, labelReq, 'ok');
        
        const dev = Math.max(5, computeTimeForSegment + jitter());
        activity(`ssd${i}`, t, t + dev, `CRC compute (${segBytes}B)`);
        
        const isErr = state.showError && (i === Math.floor(state.W / 2)) && (s === 0);
        if (isErr) {
          t = msg(`ssd${i}`, 'host', t + dev, t + dev + lat, `Completion(ERROR)`, 'err');
          t += 40; // backoff
          const labelReq2 = state.showLabels ? `Retry CRC_Calc(seed=${calcCRC})` : `Retry CRC_Calc`;
          t = msg('host', `ssd${i}`, t, t + lat, labelReq2, 'warn');
          const dev2 = Math.max(5, computeTimeForSegment * 0.8 + jitter());
          activity(`ssd${i}`, t, t + dev2, `CRC compute (retry)`);
          t = msg(`ssd${i}`, 'host', t + dev2, t + dev2 + lat, `Completion(CRCᵢ)`, 'ok');
        } else {
          t = msg(`ssd${i}`, 'host', t + dev, t + dev + lat, `Completion(CRCᵢ)`, 'ok');
        }
        calcCRC = `CRC64_COMBINE(${calcCRC}, CRCᵢ, ${segBytes})`;
      }
    }
    tmax = Math.max(tmax, events.reduce((m, e) => Math.max(m, e.t1), 0) + 40);
    note('host', tmax - 20, `Compare Calculated_CRC vs Golden_CRC`);
    
  } else if (state.solution === 's2') {
    // Parallel fan-out with host aggregation
    const t0 = 0;
    const ssdCompletes: number[][] = [];
    
    // For each SSD, send CRC_Calc commands for each segment
    for (let i = 0; i < state.W; i++) {
      ssdCompletes[i] = [];
      let tSSD = t0;
      
      for (let s = 0; s < segs; s++) {
        const labelReq = state.showLabels 
          ? `CRC_Calc(seed=0, LBA=${i}:${s}, len=${segBytes})` 
          : `CRC_Calc`;
        msg('host', `ssd${i}`, tSSD, tSSD + lat, labelReq, 'ok');
        
        const dev = Math.max(5, computeTimeForSegment + jitter());
        activity(`ssd${i}`, tSSD + lat, tSSD + lat + dev, `CRC compute (${segBytes}B)`);
        
        const isErr = state.showError && (i === Math.floor(state.W / 2)) && (s === 0);
        if (isErr) {
          msg(`ssd${i}`, 'host', tSSD + lat + dev, tSSD + lat + dev + lat, `Completion(ERROR)`, 'err');
          const backoff = 40;
          tSSD = tSSD + lat + dev + lat + backoff;
          msg('host', `ssd${i}`, tSSD, tSSD + lat, `Retry CRC_Calc`, 'warn');
          const dev2 = Math.max(5, computeTimeForSegment * 0.85 + jitter());
          activity(`ssd${i}`, tSSD + lat, tSSD + lat + dev2, `CRC compute (retry)`);
          const tDone = tSSD + lat + dev2 + lat;
          msg(`ssd${i}`, 'host', tSSD + lat + dev2, tDone, `Completion(CRC${i}_${s})`, 'ok');
          ssdCompletes[i].push(tDone);
          tSSD = tDone;
        } else {
          const tDone = tSSD + lat + dev + lat;
          msg(`ssd${i}`, 'host', tSSD + lat + dev, tDone, `Completion(CRC${i}_${s})`, 'ok');
          ssdCompletes[i].push(tDone);
          tSSD = tDone;
        }
      }
    }
    
    // Find when all SSDs complete their segments
    const completes = ssdCompletes.map(ssdSegs => Math.max(...ssdSegs));
    const allComplete = Math.max(...completes);
    
    const tStartAgg = allComplete + 10;
    
    // Host aggregation time scales with log₂ of shards (stripe width W)
    const hostAggStages = Math.ceil(Math.log2(Math.max(1, state.W)));
    const hostAggTime = Math.max(1, hostCombine * hostAggStages);
    const totalElemsHostDisplay = Math.max(1, state.W * segs);
    const hostLabel = state.showLabels 
      ? `Combine CRC`
      : '';
    activity('host', tStartAgg, tStartAgg + hostAggTime, hostLabel);
    
    tmax = tStartAgg + hostAggTime + 30;
    note('host', tmax - 20, `Compare Calculated_CRC vs Golden_CRC`);
    
  } else if (state.solution === 's3') {
    // Parallel with SSD aggregation
    const t0 = 0;
    const ssdCompletes: number[][] = [];
    
    // For each SSD, send CRC_Calc commands for each segment
    for (let i = 0; i < state.W; i++) {
      ssdCompletes[i] = [];
      let tSSD = t0;
      
      for (let s = 0; s < segs; s++) {
        const labelReq = state.showLabels 
          ? `CRC_Calc(seed=0, LBA=${i}:${s}, len=${segBytes})` 
          : `CRC_Calc`;
        msg('host', `ssd${i}`, tSSD, tSSD + lat, labelReq, 'ok');
        
        const dev = Math.max(5, computeTimeForSegment + jitter());
        activity(`ssd${i}`, tSSD + lat, tSSD + lat + dev, `CRC compute (${segBytes}B)`);
        
        const isErr = state.showError && (i === Math.floor(state.W / 2)) && (s === 0);
        if (isErr) {
          msg(`ssd${i}`, 'host', tSSD + lat + dev, tSSD + lat + dev + lat, `Completion(ERROR)`, 'err');
          const backoff = 40;
          tSSD = tSSD + lat + dev + lat + backoff;
          msg('host', `ssd${i}`, tSSD, tSSD + lat, `Retry CRC_Calc`, 'warn');
          const dev2 = Math.max(5, computeTimeForSegment * 0.85 + jitter());
          activity(`ssd${i}`, tSSD + lat, tSSD + lat + dev2, `CRC compute (retry)`);
          const tDone = tSSD + lat + dev2 + lat;
          msg(`ssd${i}`, 'host', tSSD + lat + dev2, tDone, `Completion(CRC${i}_${s})`, 'ok');
          ssdCompletes[i].push(tDone);
          tSSD = tDone;
        } else {
          const tDone = tSSD + lat + dev + lat;
          msg(`ssd${i}`, 'host', tSSD + lat + dev, tDone, `Completion(CRC${i}_${s})`, 'ok');
          ssdCompletes[i].push(tDone);
          tSSD = tDone;
        }
      }
    }
    
    // Find when all SSDs complete their segments  
    const completes = ssdCompletes.map(ssdSegs => Math.max(...ssdSegs));
    const allComplete = Math.max(...completes);
    
    const tAggReq = allComplete + 10;
    
    // Total elements to aggregate = W SSDs × segments per SSD
    const totalElems = state.W * segs;
    // Remove verbose CRC_Combine source listing from labels for Solution 3
    const listLabel = state.showLabels 
      ? `Aggregation request` 
      : ``;
    msg('host', aggId, tAggReq, tAggReq + lat, listLabel, 'ok');
    
    // Aggregation time scales with log₂ of total shards (reduction tree depth)
    const aggStages = Math.ceil(Math.log2(totalElems));
    const aggTime = Math.max(5, aggPerElem * aggStages);
    const aggActLabel = state.showLabels 
      ? `Aggregate ${totalElems} CRCs`
      : `Aggregate ${totalElems} CRCs`;
    activity(aggId, tAggReq + lat, tAggReq + lat + aggTime, aggActLabel);
    
    const tDone = tAggReq + lat + aggTime + lat;
    msg(aggId, 'host', tAggReq + lat + aggTime, tDone, `Completion(Final_CRC)`, 'ok');
    tmax = tDone + 30;
    note('host', tmax - 20, `Compare Final_CRC vs Golden_CRC`);
  }

  const lastT = Math.max(
    ...events.map(e => e.t1),
    ...activities.map(a => a.t1),
    0
  );

  const totalOps = state.W * segs;
  const totalBytes = state.W * state.chunkBytes;
  // Calculate throughput in MB/s (total bytes / latency in microseconds * 1000000 / 1024 / 1024)
  const throughput = lastT > 0 ? (totalBytes / lastT * 1000000 / 1024 / 1024).toFixed(1) : '0';
  
  const metrics: Metrics = {
    latency: lastT.toFixed(1) + ' µs (model)',
    fanout: state.solution === 's1'
      ? `${totalOps} sequential CRC ops (${state.W} SSDs × ${segs} segments)`
      : state.solution === 's2'
      ? `${totalOps} parallel CRC ops + single host combine`
      : `${totalOps} parallel CRC ops + SSD${state.aggIndex} aggregation`,
    notes: state.solution === 's1'
      ? `Sequential processing: ${segs} segment(s) per SSD, seeded chain.`
      : state.solution === 's2'
      ? `Parallel compute across SSDs; a single host operation combines all partial CRCs.`
      : `Parallel compute; SSD${state.aggIndex} aggregates all ${totalOps} CRCs.`,
    throughput: `${throughput} MB/s`
  };

  return {
    participants,
    events,
    activities,
    notes,
    tmax: Math.max(tmax, lastT),
    metrics
  };
}