'use client';

import { useState, useEffect } from 'react';
import { Coins, TrendingUp, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelUsage {
  date: string;
  channel_id: string;
  channel_name: string;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_usd: number;
  message_count: number;
}

interface TokenUsageData {
  ok: boolean;
  today: {
    tokens: number;
    cost: number;
    channels: ChannelUsage[];
  };
  week: {
    tokens: number;
    cost: number;
  };
  all: {
    tokens: number;
    cost: number;
  };
  usage: ChannelUsage[];
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatCost(n: number): string {
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(3);
  return '$' + n.toFixed(4);
}

export function TokenUsageCard() {
  const [data, setData] = useState<TokenUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:18790`
        : 'http://localhost:18790';
      const res = await fetch(`${baseUrl}/api/token-usage`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch');
      }
    } catch (e) {
      setError('连接失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get recent days for display
  const recentDays = data?.usage
    ? [...new Set(data.usage.map(u => u.date))].sort().reverse().slice(0, 7)
    : [];

  const getDayUsage = (date: string) => {
    const dayData = data?.usage.filter(u => u.date === date) || [];
    return {
      tokens: dayData.reduce((sum, u) => sum + u.tokens_total, 0),
      cost: dayData.reduce((sum, u) => sum + u.cost_usd, 0),
      channels: dayData.sort((a, b) => b.tokens_total - a.tokens_total),
    };
  };

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold">Token 使用统计</span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4 text-[hsl(var(--muted-foreground))]', loading && 'animate-spin')} />
        </button>
      </div>
      
      <div className="p-6">
        {error ? (
          <div className="text-center text-red-400 text-sm">{error}</div>
        ) : loading && !data ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-[hsl(var(--secondary))] rounded-xl"></div>
            <div className="h-24 bg-[hsl(var(--secondary))] rounded-xl"></div>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[hsl(var(--secondary))] rounded-xl p-3">
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">今日</div>
                <div className="text-lg font-bold text-white">
                  {data.today.tokens > 0 ? formatTokens(data.today.tokens) : '-'}
                </div>
                <div className="text-xs text-yellow-400">
                  {data.today.cost > 0 ? formatCost(data.today.cost) : '-'}
                </div>
              </div>
              <div className="bg-[hsl(var(--secondary))] rounded-xl p-3">
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                  {data.week.tokens > 0 ? '本周' : '总计'}
                </div>
                <div className="text-lg font-bold text-white">
                  {data.week.tokens > 0 
                    ? formatTokens(data.week.tokens) 
                    : (data.all?.tokens > 0 ? formatTokens(data.all.tokens) : '-')}
                </div>
                <div className="text-xs text-yellow-400">
                  {data.week.cost > 0 
                    ? formatCost(data.week.cost) 
                    : (data.all?.cost > 0 ? formatCost(data.all.cost) : '-')}
                </div>
              </div>
            </div>

            {/* Recent days */}
            {recentDays.length > 0 && (
              <div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center justify-between w-full text-sm text-[hsl(var(--muted-foreground))] hover:text-white transition-colors mb-2"
                >
                  <span>历史记录 ({recentDays.length} 天)</span>
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {expanded && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {recentDays.map(date => {
                      const dayUsage = getDayUsage(date);
                      return (
                        <div key={date} className="bg-[hsl(var(--secondary))] rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">{date}</span>
                            <span className="text-xs text-yellow-400">{formatCost(dayUsage.cost)}</span>
                          </div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            {formatTokens(dayUsage.tokens)} tokens
                          </div>
                          {/* Channel breakdown */}
                          <div className="mt-2 space-y-1">
                            {dayUsage.channels.slice(0, 3).map((ch, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[60%]">
                                  {ch.channel_name || ch.channel_id}
                                </span>
                                <span className="text-white">{formatTokens(ch.tokens_total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {recentDays.length === 0 && (
              <div className="text-center text-[hsl(var(--muted-foreground))] text-sm py-4">
                暂无历史数据
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
