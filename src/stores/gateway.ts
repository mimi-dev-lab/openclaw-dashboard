'use client';

import { create } from 'zustand';
import type {
  GatewayStatus,
  Agent,
  Session,
  Channel,
  HealthStatus,
  SystemMetrics,
  Task,
} from '@/lib/types';
import { getGateway, resetGateway } from '@/lib/websocket';

interface HealthPoint {
  time: string;
  score: number;
}

interface GatewayState {
  // Connection
  connected: boolean;
  connecting: boolean;
  error: string | null;
  
  // Data
  status: GatewayStatus | null;
  agents: Agent[];
  sessions: Session[];
  channels: Channel[];
  health: HealthStatus | null;
  healthHistory: HealthPoint[];
  metrics: SystemMetrics | null;
  tasks: Task[];
  
  // Actions
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  fetchHealth: () => Promise<void>;
}

function generateMockHealthHistory(): HealthPoint[] {
  const data: HealthPoint[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:00`;
    const baseScore = 85;
    const variation = Math.sin(i * 0.5) * 10 + Math.random() * 5;
    const score = Math.max(60, Math.min(100, Math.round(baseScore + variation)));
    data.push({ time: timeStr, score });
  }
  
  return data;
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  // Initial state
  connected: false,
  connecting: false,
  error: null,
  status: null,
  agents: [],
  sessions: [],
  channels: [],
  health: null,
  healthHistory: generateMockHealthHistory(),
  metrics: null,
  tasks: [],

  connect: async (url: string, token: string) => {
    set({ connecting: true, error: null });
    
    try {
      const gateway = getGateway(url, token);
      
      gateway.onConnection((connected) => {
        set({ connected });
        if (connected) {
          // Auto-fetch data on connect
          get().refresh();
        }
      });

      gateway.onMessage((message) => {
        // Handle real-time events
        console.log('[Store] Message:', message);
      });

      await gateway.connect();
      set({ connecting: false });
    } catch (err) {
      set({
        connecting: false,
        error: err instanceof Error ? err.message : 'Connection failed'
      });
    }
  },

  disconnect: () => {
    resetGateway();
    set({
      connected: false,
      status: null,
      agents: [],
      sessions: [],
      channels: [],
      health: null,
      healthHistory: generateMockHealthHistory(),
      metrics: null,
      tasks: []
    });
  },

  refresh: async () => {
    const { fetchStatus, fetchSessions, fetchChannels, fetchHealth } = get();
    await Promise.all([
      fetchStatus(),
      fetchSessions(),
      fetchChannels(),
      fetchHealth()
    ]);
  },

  fetchStatus: async () => {
    try {
      const gateway = getGateway();
      const result = await gateway.call<{ 
        heartbeat?: {
          defaultAgentId?: string;
          agents?: Array<{ agentId: string; enabled: boolean }>;
        };
        channelSummary?: string[];
      }>('status');
      
      // Get agents from heartbeat
      const agents = result?.heartbeat?.agents || [];
      
      set({
        status: {
          connected: true,
          host: 'localhost',
          version: 'OpenClaw 2026.2.x',
          os: 'macOS',
          uptime: undefined // Not available from status API
        },
        // Also update agents from heartbeat
        agents: agents.map(a => ({
          id: a.agentId,
          name: a.agentId,
          status: a.enabled ? 'active' : 'idle',
          sessions: 0,
          model: undefined
        }))
      });
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  },

  fetchSessions: async () => {
    try {
      const gateway = getGateway();
      const result = await gateway.call<{ sessions?: Array<{
        key: string;
        kind?: string;
        model?: string;
        modelProvider?: string;
        totalTokens?: number;
        contextTokens?: number;
        updatedAt?: number;
        displayName?: string;
      }> }>('sessions.list', { limit: 50 });
      
      const sessions: Session[] = (result?.sessions || []).map((s) => {
        const agentMatch = s.key.match(/^agent:([^:]+)/);
        const totalTokens = s.totalTokens || 0;
        const contextTokens = s.contextTokens || 200000;
        return {
          key: s.key,
          kind: (s.kind as 'direct' | 'group') || 'direct',
          model: s.model || 'unknown',
          tokens: {
            used: totalTokens,
            limit: contextTokens,
            percent: contextTokens ? Math.round(totalTokens / contextTokens * 100) : 0
          },
          lastActive: s.updatedAt ? new Date(s.updatedAt).toISOString() : '',
          agentId: agentMatch?.[1] || 'unknown'
        };
      });

      // Extract unique agents from sessions
      const agentMap = new Map<string, Agent>();
      sessions.forEach((session) => {
        if (!agentMap.has(session.agentId)) {
          agentMap.set(session.agentId, {
            id: session.agentId,
            name: session.agentId,
            status: 'idle',
            sessions: 0,
            model: session.model
          });
        }
        const agent = agentMap.get(session.agentId)!;
        agent.sessions++;
        if (!agent.lastActive || session.lastActive > agent.lastActive) {
          agent.lastActive = session.lastActive;
          agent.status = 'active';
        }
      });

      set({
        sessions,
        agents: Array.from(agentMap.values())
      });
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  },

  fetchChannels: async () => {
    try {
      const gateway = getGateway();
      const result = await gateway.call<{ 
        channelOrder?: string[];
        channelLabels?: Record<string, string>;
        channels?: Record<string, {
          configured?: boolean;
          running?: boolean;
          lastError?: string | null;
        }>;
      }>('channels.status');
      
      const channelOrder = result?.channelOrder || [];
      const channelLabels = result?.channelLabels || {};
      const channelsData = result?.channels || {};
      
      const channels: Channel[] = channelOrder.map((id) => {
        const data = channelsData[id] || {};
        return {
          name: channelLabels[id] || id,
          enabled: data.configured ?? false,
          status: data.running ? 'ok' : data.lastError ? 'error' : 'offline',
          detail: data.lastError || (data.running ? '运行中' : '已停止'),
        };
      });

      set({ channels });
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  },

  fetchHealth: async () => {
    try {
      const gateway = getGateway();
      const result = await gateway.call<{
        ok?: boolean;
        durationMs?: number;
        channels?: Record<string, { running?: boolean; lastError?: string | null }>;
        sessions?: { count?: number };
      }>('health');
      
      // Calculate health based on channels and overall status
      const channels = result?.channels || {};
      const channelErrors = Object.values(channels).filter(c => c.lastError).length;
      
      let score = result?.ok ? 100 : 50;
      score -= channelErrors * 15;
      
      const issues: Array<{ level: 'critical' | 'warn' | 'info'; message: string; fix?: string }> = [];
      
      // Check for channel errors
      Object.entries(channels).forEach(([name, data]) => {
        if (data.lastError) {
          issues.push({
            level: 'warn',
            message: `${name}: ${data.lastError}`,
          });
        }
      });
      
      if (!result?.ok) {
        issues.push({
          level: 'critical',
          message: 'Gateway health check failed',
        });
      }

      const finalScore = Math.max(0, Math.min(100, score));
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const currentHistory = get().healthHistory;
      const lastPoint = currentHistory[currentHistory.length - 1];
      
      // Only add new point if different
      let newHistory = currentHistory;
      if (!lastPoint || lastPoint.time !== timeStr || lastPoint.score !== finalScore) {
        newHistory = [...currentHistory, { time: timeStr, score: finalScore }].slice(-24);
      }
      
      set({
        health: {
          score: finalScore,
          status: finalScore >= 80 ? 'healthy' : finalScore >= 60 ? 'warning' : 'critical',
          issues,
          channelErrors,
          logErrors: issues.length
        },
        healthHistory: newHistory
      });
    } catch (err) {
      console.error('Failed to fetch health:', err);
    }
  }
}));
