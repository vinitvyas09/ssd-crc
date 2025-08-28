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
  const jitter = () => state.randomize ? (Math.random() - 0.5) * baseDev * 0.3 : 0;
  
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
        
        const dev = Math.max(5, baseDev + jitter());
        activity(`ssd${i}`, t, t + dev, `CRC compute (${segBytes}B)`);
        
        const isErr = state.showError && (i === Math.floor(state.W / 2)) && (s === 0);
        if (isErr) {
          t = msg(`ssd${i}`, 'host', t + dev, t + dev + lat, `Completion(ERROR)`, 'err');
          t += 40; // backoff
          const labelReq2 = state.showLabels ? `Retry CRC_Calc(seed=${calcCRC})` : `Retry CRC_Calc`;
          t = msg('host', `ssd${i}`, t, t + lat, labelReq2, 'warn');
          const dev2 = Math.max(5, baseDev * 0.8 + jitter());
          activity(`ssd${i}`, t, t + dev2, `CRC compute (retry)`);
          t = msg(`ssd${i}`, 'host', t + dev2, t + dev2 + lat, `Completion(CRCᵢ)`, 'ok');
        } else {
          t = msg(`ssd${i}`, 'host', t + dev, t + dev + lat, `Completion(CRCᵢ)`, 'ok');
        }
        calcCRC = `CRC64_COMBINE(${calcCRC}, CRCᵢ, ${segBytes})`;
        note('host', t + 4, `Calculated_CRC ← ${calcCRC}`);
      }
    }
    tmax = Math.max(tmax, events.reduce((m, e) => Math.max(m, e.t1), 0) + 40);
    note('host', tmax - 20, `Compare Calculated_CRC vs Golden_CRC`);
    
  } else if (state.solution === 's2') {
    // Parallel fan-out with host aggregation
    const t0 = 0;
    
    for (let i = 0; i < state.W; i++) {
      const labelReq = state.showLabels 
        ? `CRC_Calc(seed=0, LBA=${i}, len=${chunkBytes})` 
        : `CRC_Calc(seed=0)`;
      msg('host', `ssd${i}`, t0, t0 + lat, labelReq, 'ok');
    }
    
    const completes: number[] = [];
    for (let i = 0; i < state.W; i++) {
      const dev = Math.max(5, baseDev + jitter());
      activity(`ssd${i}`, t0 + lat, t0 + lat + dev, `CRC compute (${chunkBytes}B)`);
      
      const isErr = state.showError && (i === Math.floor(state.W / 2));
      if (isErr) {
        msg(`ssd${i}`, 'host', t0 + lat + dev, t0 + lat + dev + lat, `Completion(ERROR)`, 'err');
        const backoff = 40;
        msg('host', `ssd${i}`, t0 + lat + dev + lat + backoff, t0 + lat + dev + lat + backoff + lat, `Retry CRC_Calc(seed=0)`, 'warn');
        const dev2 = Math.max(5, baseDev * 0.85 + jitter());
        activity(`ssd${i}`, t0 + lat + dev + lat + backoff + lat, t0 + lat + dev + lat + backoff + lat + dev2, `CRC compute (retry)`);
        const tDone = t0 + lat + dev + lat + backoff + lat + dev2 + lat;
        msg(`ssd${i}`, 'host', t0 + lat + dev + lat + backoff + lat + dev2, tDone, `Completion(CRC${i})`, 'ok');
        completes.push(tDone);
      } else {
        const tDone = t0 + lat + dev + lat;
        msg(`ssd${i}`, 'host', t0 + lat + dev, tDone, `Completion(CRC${i})`, 'ok');
        completes.push(tDone);
      }
    }
    
    const tStartAgg = Math.max(...completes) + 10;
    let count = state.W;
    let stage = 0;
    let tStage = tStartAgg;
    
    while (count > 1) {
      const ops = Math.floor(count / 2);
      for (let j = 0; j < ops; j++) {
        activity('host', tStage, tStage + hostCombine, `Combine stage ${stage + 1}: CRC64_COMBINE(pair ${j + 1})`);
      }
      tStage += hostCombine + 10;
      count = Math.ceil(count / 2);
      stage++;
    }
    
    tmax = tStage + 30;
    note('host', tmax - 20, `Compare Calculated_CRC vs Golden_CRC`);
    
  } else if (state.solution === 's3') {
    // Parallel with SSD aggregation
    const t0 = 0;
    
    for (let i = 0; i < state.W; i++) {
      const labelReq = state.showLabels 
        ? `CRC_Calc(seed=0, LBA=${i}, len=${chunkBytes})` 
        : `CRC_Calc(seed=0)`;
      msg('host', `ssd${i}`, t0, t0 + lat, labelReq, 'ok');
    }
    
    const completes: number[] = [];
    for (let i = 0; i < state.W; i++) {
      const dev = Math.max(5, baseDev + jitter());
      activity(`ssd${i}`, t0 + lat, t0 + lat + dev, `CRC compute (${chunkBytes}B)`);
      
      const isErr = state.showError && (i === Math.floor(state.W / 2));
      if (isErr) {
        msg(`ssd${i}`, 'host', t0 + lat + dev, t0 + lat + dev + lat, `Completion(ERROR)`, 'err');
        const backoff = 40;
        msg('host', `ssd${i}`, t0 + lat + dev + lat + backoff, t0 + lat + dev + lat + backoff + lat, `Retry CRC_Calc(seed=0)`, 'warn');
        const dev2 = Math.max(5, baseDev * 0.85 + jitter());
        activity(`ssd${i}`, t0 + lat + dev + lat + backoff + lat, t0 + lat + dev + lat + backoff + lat + dev2, `CRC compute (retry)`);
        const tDone = t0 + lat + dev + lat + backoff + lat + dev2 + lat;
        msg(`ssd${i}`, 'host', t0 + lat + dev + lat + backoff + lat + dev2, tDone, `Completion(CRC${i})`, 'ok');
        completes.push(tDone);
      } else {
        const tDone = t0 + lat + dev + lat;
        msg(`ssd${i}`, 'host', t0 + lat + dev, tDone, `Completion(CRC${i})`, 'ok');
        completes.push(tDone);
      }
    }
    
    const tAggReq = Math.max(...completes) + 10;
    const listLabel = state.showLabels 
      ? `CRC_Combine(Src=[(CRC0,${chunkBytes}),…×W])` 
      : `CRC_Combine(list)`;
    msg('host', aggId, tAggReq, tAggReq + lat, listLabel, 'ok');
    
    const aggTime = Math.max(5, aggPerElem * state.W);
    activity(aggId, tAggReq + lat, tAggReq + lat + aggTime, `Aggregate ${state.W} elems`);
    
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

  const metrics: Metrics = {
    latency: lastT.toFixed(1) + ' µs (model)',
    fanout: state.solution === 's1'
      ? '1 in-flight per object (serialized)'
      : state.solution === 's2'
      ? `${state.W} CRC_Calc + host combine`
      : `${state.W} CRC_Calc + 1 CRC_Combine on SSD${state.aggIndex}`,
    notes: state.solution === 's1'
      ? 'Head-of-line risk per object; steady-state pipeline.'
      : state.solution === 's2'
      ? 'Parallel per-SSD compute; host runs log₂(W) combine stages.'
      : 'Parallel per-SSD compute; device-side reduction + single completion.'
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