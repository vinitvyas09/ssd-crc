export type SolutionType = 's1' | 's2' | 's3';
export type MessageStatus = 'ok' | 'err' | 'warn';
export type ViewMode = 'timing' | 'distribution' | 'ai' | 'enterprise';

export interface Participant {
  id: string;
  label: string;
}

export interface Message {
  type: 'msg';
  from: string;
  to: string;
  t0: number;
  t1: number;
  label: string;
  status: MessageStatus;
}

export interface Activity {
  type: 'act';
  lane: string;
  t0: number;
  t1: number;
  label: string;
}

export interface Note {
  type: 'note';
  lane: string;
  t: number;
  label: string;
}

export interface Metrics {
  latency: string;
  fanout: string;
  notes: string;
  throughput: string;
}

export interface WorkflowModel {
  participants: Participant[];
  events: Message[];
  activities: Activity[];
  notes: Note[];
  tmax: number;
  metrics: Metrics;
}

export interface WorkflowState {
  solution: SolutionType;
  viewMode: ViewMode;
  W: number;
  segments: number;
  chunkBytes: number;
  shardSizeGB: number;
  objectSizeGB: number;
  aggIndex: number;
  showError: boolean;
  showLabels: boolean;
  randomize: boolean;
  dark: boolean;
  lat: number;
  dev: number;
  hostc: number;
  aggc: number;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

export const initialState: WorkflowState = {
  solution: 's2',
  viewMode: 'enterprise',
  W: 6,
  segments: 1,
  chunkBytes: 4096,
  shardSizeGB: 1,
  objectSizeGB: 10,
  aggIndex: 0,
  showError: false,
  showLabels: true,
  randomize: false,
  dark: true,
  lat: 5,
  dev: 100,
  hostc: 6,
  aggc: 6,
};

export const SOLUTIONS = {
  s1: '#1 Serial CRC with seeding',
  s2: '#2 Parallel CRC + Host Aggregation',
  s3: '#3 Parallel CRC + SSD Aggregation',
} as const;
