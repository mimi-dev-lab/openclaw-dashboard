'use client';

import { useState, useEffect } from 'react';
import { Zap, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageData {
  ok: boolean;
  session: {
    utilization: number;
    resets_in: string;
    resets_at: string;
  };
  weekly: {
    utilization: number;
    resets_in: string;
    resets_at: string;
  };
}

function ProgressBar({ value, color }: { value: number; color: 'green' | 'yellow' | 'red' }) {
  const colorMap = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };
  
  return (
    <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
      <div 
        className={cn('h-full rounded-full transition-all duration-500', colorMap[color])}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function getColor(value: number): 'green' | 'yellow' | 'red' {
  if (value <= 50) return 'green';
  if (value <= 80) return 'yellow';
  return 'red';
}

// Calculate time until next Friday 15:00 JST
function getWeeklyResetTime(): string {
  const now = new Date();
  const jstOffset = 9 * 60; // JST is UTC+9
  const nowJST = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
  
  // Find next Friday
  const dayOfWeek = nowJST.getDay(); // 0=Sun, 5=Fri
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  
  // If it's Friday, check if we're past 15:00
  if (daysUntilFriday === 0) {
    const hour = nowJST.getHours();
    if (hour >= 15) {
      daysUntilFriday = 7; // Next Friday
    }
  }
  
  // Calculate remaining time
  const resetJST = new Date(nowJST);
  resetJST.setDate(resetJST.getDate() + daysUntilFriday);
  resetJST.setHours(15, 0, 0, 0);
  
  const diffMs = resetJST.getTime() - nowJST.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  }
  return `${diffHours}h`;
}

export function ClaudeUsageCard() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:18790`
        : 'http://localhost:18790';
      const res = await fetch(`${baseUrl}/api/claude-usage`);
      const data = await res.json();
      if (data.ok) {
        setUsage(data);
      } else {
        setError(data.error || 'Failed to fetch');
      }
    } catch (e) {
      setError('连接失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">Claude Code 额度</span>
        </div>
        <button
          onClick={fetchUsage}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4 text-[hsl(var(--muted-foreground))]', loading && 'animate-spin')} />
        </button>
      </div>
      
      <div className="p-6">
        {error ? (
          <div className="text-center text-red-400 text-sm">{error}</div>
        ) : loading && !usage ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-[hsl(var(--secondary))] rounded-xl"></div>
            <div className="h-12 bg-[hsl(var(--secondary))] rounded-xl"></div>
          </div>
        ) : usage ? (
          <div className="space-y-5">
            {/* Session (5h) - Rolling window */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-sm font-medium">Session (5h)</span>
                </div>
                <span className={cn(
                  'text-sm font-bold',
                  usage.session.utilization <= 50 ? 'text-green-400' :
                  usage.session.utilization <= 80 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {usage.session.utilization}%
                </span>
              </div>
              <ProgressBar value={usage.session.utilization} color={getColor(usage.session.utilization)} />
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
                滚动窗口（持续释放）
              </div>
            </div>

            {/* Weekly (7d) - Resets every Friday 15:00 JST */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-sm font-medium">Weekly (7d)</span>
                </div>
                <span className={cn(
                  'text-sm font-bold',
                  usage.weekly.utilization <= 50 ? 'text-green-400' :
                  usage.weekly.utilization <= 80 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {usage.weekly.utilization}%
                </span>
              </div>
              <ProgressBar value={usage.weekly.utilization} color={getColor(usage.weekly.utilization)} />
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
                重置: {getWeeklyResetTime()}（周五 15:00）
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
