'use client';

import { create } from 'zustand';
import { gatewayBatchWithSnapshot, gatewayCall } from '@/lib/gateway-client';

// Types
export interface Session {
  key: string;
  channel?: string;
  label?: string;
  displayName?: string;
  createdAt?: string;
  lastActivityAt?: string;
  tokenCount?: number;
  totalTokens?: number;
  model?: string;
  modelProvider?: string;
  agentId?: string;
  updatedAt?: number;
}

export interface CronJob {
  id: string;
  name?: string;
  agentId?: string;
  schedule: {
    kind: string;
    expr?: string;
    tz?: string;
    everyMs?: number;
  };
  enabled: boolean;
  payload?: {
    kind?: string;
    message?: string;
  };
  state?: {
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastStatus?: string;
    lastDurationMs?: number;
    lastError?: string;
  };
}

export interface Channel {
  id: string;
  name: string;
  connected: boolean;
  botName?: string;
}

export interface Agent {
  id: string;
  name?: string;
  model?: string;
  sessionCount: number;
  isDefault: boolean;
}

export interface SystemInfo {
  version?: string;
  uptimeMs?: number;
  host?: string;
  platform?: string;
}

export interface HealthEntry {
  ts: number;
  ok: boolean;
  latencyMs?: number;
}

export interface GatewayState {
  url: string | null;
  token: string | null;
  sessions: Session[];
  cronJobs: CronJob[];
  channels: Channel[];
  agents: Agent[];
  systemInfo: SystemInfo | null;
  healthHistory: HealthEntry[];
  isLoading: boolean;
  lastRefresh: Date | null;
  error: string | null;
  autoRefreshInterval: number | null;
  autoRefreshTimer: NodeJS.Timeout | null;
  
  setConfig: (url: string, token: string) => void;
  loadSavedConfig: () => boolean;
  clearConfig: () => void;
  refresh: () => Promise<void>;
  setAutoRefresh: (intervalMs: number | null) => void;
  clearError: () => void;
  restartGateway: () => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  fetchSessionHistory: (sessionKey: string, limit?: number) => Promise<SessionMessage[]>;
  sendSessionMessage: (sessionKey: string, message: string) => Promise<boolean>;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// Extract agentId from session key
function extractAgentId(key: string): string {
  // Format: agent:claude-main:discord:channel:xxx
  const parts = key.split(':');
  if (parts[0] === 'agent' && parts.length >= 2) {
    return parts[1];
  }
  return 'unknown';
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  url: null,
  token: null,
  sessions: [],
  cronJobs: [],
  channels: [],
  agents: [],
  systemInfo: null,
  healthHistory: [],
  isLoading: false,
  lastRefresh: null,
  error: null,
  autoRefreshInterval: null,
  autoRefreshTimer: null,

  setConfig: (url, token) => {
    set({ url, token, error: null });
    if (typeof window !== 'undefined') {
      localStorage.setItem('openclaw-gateway-url', url);
      localStorage.setItem('openclaw-gateway-token', token);
    }
  },

  loadSavedConfig: () => {
    if (typeof window === 'undefined') return false;
    const url = localStorage.getItem('openclaw-gateway-url');
    const token = localStorage.getItem('openclaw-gateway-token');
    if (url && token) {
      set({ url, token });
      return true;
    }
    return false;
  },

  clearConfig: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('openclaw-gateway-url');
      localStorage.removeItem('openclaw-gateway-token');
    }
    set({ 
      url: null, token: null, sessions: [], cronJobs: [], 
      channels: [], agents: [], systemInfo: null 
    });
  },

  refresh: async () => {
    const { url, token } = get();
    if (!url || !token) {
      set({ error: '未配置连接' });
      return;
    }

    set({ isLoading: true, error: null });
    const startTime = Date.now();

    try {
      const { snapshot, results } = await gatewayBatchWithSnapshot<{
        'sessions.list': { sessions?: Session[] };
        'cron.list': { jobs?: CronJob[] };
      }>(
        { url, token },
        [
          { method: 'sessions.list', params: { limit: 100 } },
          { method: 'cron.list' },
        ]
      );

      const latencyMs = Date.now() - startTime;
      
      // Process sessions
      const sessionsData = results['sessions.list'] || {};
      const sessionsList: Session[] = (sessionsData.sessions || []).map(s => ({
        ...s,
        agentId: extractAgentId(s.key),
      }));

      // Process cron jobs
      const cronData = results['cron.list'] || {};
      const cronJobs = cronData.jobs || [];

      // Process channels from snapshot.health
      const healthData = snapshot.health;
      const channels: Channel[] = [];
      if (healthData?.channels) {
        const labels = healthData.channelLabels || {};
        for (const [id, info] of Object.entries(healthData.channels)) {
          channels.push({
            id,
            name: labels[id] || id,
            connected: info.probe?.ok ?? info.configured,
            botName: info.probe?.bot?.username,
          });
        }
      }

      // Process agents from snapshot.health
      const agents: Agent[] = [];
      if (healthData?.agents) {
        for (const agent of healthData.agents) {
          agents.push({
            id: agent.agentId,
            name: agent.name,
            sessionCount: agent.sessions?.count || 0,
            isDefault: agent.isDefault || false,
          });
        }
      }

      // System info
      const systemInfo: SystemInfo = {
        version: snapshot.health ? 'running' : undefined,
        uptimeMs: snapshot.uptimeMs,
        host: undefined,
        platform: undefined,
      };

      // Update health history
      const { healthHistory } = get();
      const newHealth: HealthEntry = { 
        ts: Date.now(), 
        ok: healthData?.ok ?? true, 
        latencyMs 
      };
      const updatedHistory = [...healthHistory, newHealth].slice(-60);

      set({
        systemInfo,
        sessions: sessionsList,
        cronJobs,
        channels,
        agents,
        healthHistory: updatedHistory,
        lastRefresh: new Date(),
        isLoading: false,
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const { healthHistory } = get();
      const newHealth: HealthEntry = { ts: Date.now(), ok: false, latencyMs };
      const updatedHistory = [...healthHistory, newHealth].slice(-60);

      set({
        error: err instanceof Error ? err.message : '未知错误',
        healthHistory: updatedHistory,
        isLoading: false,
      });
    }
  },

  setAutoRefresh: (intervalMs) => {
    const { autoRefreshTimer } = get();
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    if (intervalMs === null) {
      set({ autoRefreshInterval: null, autoRefreshTimer: null });
      return;
    }

    const timer = setInterval(() => get().refresh(), intervalMs);
    set({ autoRefreshInterval: intervalMs, autoRefreshTimer: timer });
  },

  clearError: () => set({ error: null }),

  restartGateway: async () => {
    const { url, token } = get();
    if (!url || !token) return false;
    try {
      await gatewayCall({ url, token }, 'gateway.restart', {});
      return true;
    } catch {
      return false;
    }
  },

  testConnection: async () => {
    const { url, token } = get();
    if (!url || !token) return false;
    try {
      await gatewayCall({ url, token }, 'health', {});
      return true;
    } catch {
      return false;
    }
  },

  fetchSessionHistory: async (sessionKey: string, limit = 50): Promise<SessionMessage[]> => {
    const { url, token } = get();
    if (!url || !token) return [];
    try {
      const result = await gatewayCall<{ messages?: SessionMessage[] }>(
        { url, token },
        'sessions.history',
        { sessionKey, limit, includeTools: false }
      );
      return result.messages || [];
    } catch (err) {
      console.error('Failed to fetch session history:', err);
      return [];
    }
  },

  sendSessionMessage: async (sessionKey: string, message: string): Promise<boolean> => {
    const { url, token } = get();
    if (!url || !token) return false;
    try {
      await gatewayCall(
        { url, token },
        'sessions.send',
        { sessionKey, message }
      );
      return true;
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    }
  },
}));
