// OpenClaw Gateway Types

export interface GatewayStatus {
  connected: boolean;
  host?: string;
  version?: string;
  uptime?: number;
  os?: string;
  node?: string;
}

export interface Agent {
  id: string;
  name?: string;
  role?: string;
  model?: string;
  status: 'active' | 'idle' | 'offline';
  sessions: number;
  lastActive?: string;
}

export interface Session {
  key: string;
  kind: 'direct' | 'group';
  model: string;
  tokens: {
    used: number;
    limit: number;
    percent: number;
  };
  lastActive: string;
  agentId: string;
}

export interface Channel {
  name: string;
  enabled: boolean;
  status: 'ok' | 'error' | 'warning' | 'offline';
  detail?: string;
  accounts?: number;
}

export interface HealthStatus {
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  issues: HealthIssue[];
  channelErrors: number;
  logErrors: number;
}

export interface HealthIssue {
  level: 'critical' | 'warn' | 'info';
  message: string;
  fix?: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  uptime: number;
}

export interface Task {
  id: string;
  name: string;
  agent: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  iterations?: number;
}

export interface CronJob {
  id: string;
  name?: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// RPC Types
export interface RPCRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface RPCResponse<T = unknown> {
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

// WebSocket Message Types
export interface WSMessage {
  type: string;
  payload?: unknown;
}

export interface ConnectParams {
  auth: {
    token?: string;
    password?: string;
  };
}
