'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { CardSkeleton, ChartSkeleton } from '@/components/Skeleton';
import { 
  Bot, Zap, TrendingUp, Clock, RefreshCw, Calendar,
  Cpu, Database, MessageSquare, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UsageData {
  session: { utilization: number; resets_in: string };
  weekly: { utilization: number; resets_in: string };
}

interface AgentData {
  name: string;
  tokens: number;
  cost: number;
  cacheRead: number;
  messages: number;
  cacheRate: string;
}

interface DateData {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
  cacheRead: number;
}

interface ThreadData {
  name: string;
  tokens: number;
  cost: number;
  messages: number;
}

interface ForumData {
  forum: string;
  name: string;
  category: string;
  tokens: number;
  cost: number;
  messages: number;
  threads: ThreadData[];
}

interface CategoryData {
  name: string;
  tokens: number;
  cost: number;
  messages: number;
}

interface TokenData {
  dateRange: { from: string; to: string; days: number };
  today: { tokens: number; cost: number };
  week: { tokens: number; cost: number };
  all: { tokens: number; cost: number; messages: number };
  cache: { totalRead: number; rate: string; saved: number };
  projection: { daily: number; weekly: number; monthly: number };
  byAgent: AgentData[];
  byDate: DateData[];
  byForum?: ForumData[];
  byCategory?: CategoryData[];
}

function formatTokens(n: number): string {
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function ProgressBar({ value, color, size = 'md' }: { value: number; color: string; size?: 'sm' | 'md' }) {
  const heights = { sm: 'h-1.5', md: 'h-2.5' };
  return (
    <div className={cn('bg-[hsl(var(--secondary))] rounded-full overflow-hidden', heights[size])}>
      <div 
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function getStatusColor(value: number): string {
  if (value <= 50) return 'bg-green-500';
  if (value <= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getWeeklyResetTime(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const nowJST = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
  const dayOfWeek = nowJST.getDay();
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  if (daysUntilFriday === 0 && nowJST.getHours() >= 15) daysUntilFriday = 7;
  const resetJST = new Date(nowJST);
  resetJST.setDate(resetJST.getDate() + daysUntilFriday);
  resetJST.setHours(15, 0, 0, 0);
  const diffMs = resetJST.getTime() - nowJST.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`;
}

const AGENT_COLORS: Record<string, string> = {
  'claude-main': '#A855F7',
  'claude-sonnet': '#3B82F6',
  'claude-haiku': '#10B981',
  'gemini-pro': '#F59E0B',
  'gemini-flash': '#EF4444',
  'gemini-image': '#EC4899',
  'main': '#6B7280',
};

const CATEGORY_COLORS: Record<string, string> = {
  '🔨 BUILD': '#3B82F6',
  '💰 WEALTH': '#F59E0B',
  '🌏 LIFE': '#10B981',
  '🧠 GROWTH': '#A855F7',
  '🏠 HOME': '#EC4899',
};

const TIME_RANGES = [
  { label: '24h', days: 1 },
  { label: '7天', days: 7 },
  { label: '14天', days: 14 },
  { label: '30天', days: 30 },
];

export default function ModelsPage() {
  const [claudeUsage, setClaudeUsage] = useState<UsageData | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(7);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [forumsExpanded, setForumsExpanded] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const baseUrl = typeof window !== 'undefined' 
      ? `http://${window.location.hostname}:18790` : 'http://localhost:18790';
    
    try {
      const [usageRes, tokenRes] = await Promise.all([
        fetch(`${baseUrl}/api/claude-usage`),
        fetch(`${baseUrl}/api/token-usage?days=${selectedRange}`),
      ]);
      
      const usageData = await usageRes.json();
      const tokenDataJson = await tokenRes.json();
      
      if (usageData.ok) setClaudeUsage(usageData);
      if (tokenDataJson.ok) setTokenData(tokenDataJson);
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        fetchData();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  const syncDiscord = async () => {
    setSyncing(true);
    const baseUrl = typeof window !== 'undefined' 
      ? `http://${window.location.hostname}:18790` : 'http://localhost:18790';
    try {
      const res = await fetch(`${baseUrl}/api/sync-discord`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        // Refresh data after sync
        fetchData();
      }
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Prepare chart data
  const trendData = tokenData?.byDate?.map(d => ({
    date: d.date.slice(5),
    tokens: d.tokens / 1e6,
    messages: d.messages,
  })) || [];

  const agentPieData = tokenData?.byAgent?.map(a => ({
    name: a.name,
    value: a.tokens,
    cacheRate: a.cacheRate,
    messages: a.messages,
  })) || [];

  const chartColors = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6B7280'];

  // Calculate daily average tokens
  const dailyAvgTokens = tokenData?.all?.tokens && tokenData?.dateRange?.days 
    ? tokenData.all.tokens / tokenData.dateRange.days 
    : 0;

  if (loading && !tokenData) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Bot className="w-7 h-7 text-purple-400" />
                Token 统计
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
              <ChartSkeleton />
            </div>
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
              <ChartSkeleton />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Bot className="w-7 h-7 text-purple-400" />
              Token 统计
            </h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">Claude Code Max 订阅额度监控</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[hsl(var(--secondary))] rounded-lg p-1">
              {TIME_RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setSelectedRange(r.days)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    selectedRange === r.days 
                      ? 'bg-purple-600 text-white' 
                      : 'text-[hsl(var(--muted-foreground))] hover:text-white'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                autoRefresh ? 'bg-green-600 text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
              )}
            >
              {autoRefresh ? '⏸ 自动' : '▶ 自动'}
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Quota Status - Most Important */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Session 额度 (5h)</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {claudeUsage?.session.utilization ?? '-'}%
            </div>
            <ProgressBar 
              value={claudeUsage?.session.utilization || 0} 
              color={getStatusColor(claudeUsage?.session.utilization || 0)} 
            />
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2">滚动窗口限制</div>
          </div>

          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Weekly 额度 (7d)</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {claudeUsage?.weekly.utilization ?? '-'}%
            </div>
            <ProgressBar 
              value={claudeUsage?.weekly.utilization || 0} 
              color={getStatusColor(claudeUsage?.weekly.utilization || 0)} 
            />
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
              重置: {getWeeklyResetTime()} (周五 15:00)
            </div>
          </div>

          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {selectedRange === 1 ? '今日' : `${selectedRange}天`} Token
              </span>
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-purple-400 mb-1">
              {tokenData?.all?.tokens ? formatTokens(tokenData.all.tokens) : '-'}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              日均 {formatTokens(dailyAvgTokens)}
            </div>
          </div>

          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Cache 命中率</span>
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400 mb-1">
              {tokenData?.cache?.rate || '-'}%
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              节省 {tokenData?.cache?.totalRead ? formatTokens(tokenData.cache.totalRead) : '-'} tokens
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{tokenData?.all?.messages?.toLocaleString() || '-'}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">消息数</div>
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {tokenData?.all?.messages && tokenData?.all?.tokens
                  ? formatTokens(Math.round(tokenData.all.tokens / tokenData.all.messages))
                  : '-'}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">平均 Token/消息</div>
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Layers className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{tokenData?.dateRange?.days || '-'}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">统计天数</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Daily Trend */}
          <div className="lg:col-span-2 bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">每日 Token 消耗</span>
            </div>
            <div className="p-6">
              {trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-[hsl(var(--muted-foreground))]">暂无数据</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis 
                        stroke="#666" fontSize={11} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${v}M`}
                        width={40}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px', 
                          fontSize: '12px',
                          color: 'white'
                        }}
                        itemStyle={{ color: 'white' }}
                        labelStyle={{ color: 'white' }}
                        formatter={(value) => [`${Number(value).toFixed(2)}M tokens`, 'Token']}
                      />
                      <Area type="monotone" dataKey="tokens" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Agent Distribution */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Agent Token 分布</span>
            </div>
            <div className="p-4">
              {agentPieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-[hsl(var(--muted-foreground))]">暂无数据</div>
              ) : (
                <div className="flex flex-col">
                  <div className="h-28 mb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={agentPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          dataKey="value"
                          stroke="none"
                        >
                          {agentPieData.map((entry, index) => (
                            <Cell key={entry.name} fill={AGENT_COLORS[entry.name] || chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between text-xs px-2 py-1 text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))] mb-1">
                    <span>Agent</span>
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-right">Cache</span>
                      <span className="w-14 text-right">Tokens</span>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {agentPieData.map((agent, i) => (
                      <div key={agent.name} className="flex items-center justify-between text-xs px-2 py-1.5 bg-[hsl(var(--secondary))] rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AGENT_COLORS[agent.name] || chartColors[i] }} />
                          <span className="text-white truncate">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn(
                            'font-medium w-12 text-right',
                            parseFloat(agent.cacheRate) >= 90 ? 'text-green-400' :
                            parseFloat(agent.cacheRate) >= 70 ? 'text-yellow-400' : 'text-red-400'
                          )}>
                            {agent.cacheRate}%
                          </span>
                          <span className="text-purple-400 w-14 text-right">{formatTokens(agent.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Forum Distribution - Token focused */}
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden mb-6">
          <button 
            onClick={() => setForumsExpanded(!forumsExpanded)}
            className="w-full px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">Forum Token 消耗</span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                (按 Discord 分类)
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); syncDiscord(); }}
                disabled={syncing}
                className="ml-2 px-2 py-1 text-xs bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 rounded-md transition-all disabled:opacity-50 flex items-center gap-1"
                title="同步 Discord 结构"
              >
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                <span>{syncing ? '同步中' : '同步'}</span>
              </button>
            </div>
            {forumsExpanded ? (
              <ChevronUp className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            )}
          </button>
          
          {forumsExpanded && (
            <div className="p-6">
              {/* Category Cards */}
              {tokenData?.byCategory && tokenData.byCategory.length > 0 && (
                <div className="mb-6">
                  <div className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-3">分类总览</div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {tokenData.byCategory.map((cat) => {
                      const totalTokens = tokenData.all?.tokens || 1;
                      const percentage = ((cat.tokens / totalTokens) * 100).toFixed(1);
                      const maxTokens = tokenData.byCategory?.[0]?.tokens || 1;
                      const barWidth = (cat.tokens / maxTokens) * 100;
                      
                      return (
                        <div 
                          key={cat.name} 
                          className="bg-[hsl(var(--secondary))] rounded-xl p-4 border-l-4"
                          style={{ borderLeftColor: CATEGORY_COLORS[cat.name] || '#666' }}
                        >
                          <div className="text-lg font-medium text-white mb-1">{cat.name}</div>
                          <div className="text-2xl font-bold text-purple-400 mb-2">
                            {formatTokens(cat.tokens)}
                          </div>
                          <div className="h-2 bg-[hsl(var(--card))] rounded-full overflow-hidden mb-2">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                width: `${barWidth}%`,
                                backgroundColor: CATEGORY_COLORS[cat.name] || '#666'
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                            <span>{percentage}%</span>
                            <span>{cat.messages} msg</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Forum Details */}
              <div className="space-y-3">
                {tokenData?.byForum?.map((forum, i) => {
                  const maxTokens = tokenData.byForum?.[0]?.tokens || 1;
                  const percentage = ((forum.tokens / (tokenData.all?.tokens || 1)) * 100).toFixed(1);
                  return (
                    <div key={forum.forum} className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{forum.name.split(' ')[0]}</span>
                          <span className="text-sm font-medium text-white">{forum.forum}</span>
                          <span className="text-xs px-2 py-0.5 rounded text-[hsl(var(--muted-foreground))]" 
                                style={{ backgroundColor: `${CATEGORY_COLORS[forum.category] || '#666'}20` }}>
                            {forum.category}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-purple-400">{formatTokens(forum.tokens)}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">({percentage}%)</span>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-2 bg-[hsl(var(--card))] rounded-full overflow-hidden mb-3">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${(forum.tokens / maxTokens) * 100}%`,
                            backgroundColor: CATEGORY_COLORS[forum.category] || chartColors[i % chartColors.length]
                          }}
                        />
                      </div>
                      
                      {/* Threads */}
                      {forum.threads?.length > 0 && (
                        <div className="space-y-1.5 pl-4 border-l-2 border-[hsl(var(--border))]">
                          {forum.threads.map(thread => (
                            <div key={thread.name} className="flex items-center justify-between text-sm">
                              <span className="text-[hsl(var(--muted-foreground))]">└ {thread.name}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{thread.messages} msg</span>
                                <span className="text-purple-400 font-medium">{formatTokens(thread.tokens)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Model Info */}
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-purple-400" />
            <span className="font-semibold">订阅信息</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">订阅类型</div>
              <div className="text-sm font-medium text-white">Claude Code Max</div>
            </div>
            <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">默认模型</div>
              <div className="text-sm font-medium text-white">claude-opus-4-5</div>
            </div>
            <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Context 窗口</div>
              <div className="text-sm font-medium text-white">200K tokens</div>
            </div>
            <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">计费方式</div>
              <div className="text-sm font-medium text-green-400">订阅制 (无额外费用)</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
