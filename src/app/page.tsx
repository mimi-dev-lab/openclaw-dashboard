'use client';

import { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { ClaudeUsageCard } from '@/components/ClaudeUsageCard';
import { TokenUsageCard } from '@/components/TokenUsageCard';
import { StatCardSkeleton, ListItemSkeleton } from '@/components/Skeleton';
import { 
  Clock, Bot, Radio, Zap, Brain, FolderOpen, FileText,
  Activity, TrendingUp, RefreshCw, Server, CheckCircle, 
  AlertTriangle, XCircle, ArrowUp, ArrowDown, Minus, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DashboardStatus {
  memoryFiles: number;
  skills: number;
  projects: number;
  channels: number;
  workspace: string;
}

interface StatusResponse {
  ok: boolean;
  status: DashboardStatus;
  channels: { id: string; name: string }[];
  skills: { name: string; path: string; location?: string }[];
  projects: { name: string; language: string; modified: string }[];
  memoryFiles: { name: string; type: string; modified: string; size?: number }[];
}

interface HealthStatus {
  gateway: 'ok' | 'warning' | 'error';
  cron: 'ok' | 'warning' | 'error';
  memory: 'ok' | 'warning' | 'error';
  hippocampus: 'ok' | 'warning' | 'error';
  lastCheck: Date;
}

interface TrendData {
  memoryFiles: { current: number; previous: number };
  skills: { current: number; previous: number };
  projects: { current: number; previous: number };
}

function HealthBar({ health }: { health: HealthStatus }) {
  const items = [
    { key: 'gateway', label: 'Gateway', status: health.gateway },
    { key: 'cron', label: 'Cron', status: health.cron },
    { key: 'memory', label: 'Memory', status: health.memory },
    { key: 'hippocampus', label: 'Hippocampus', status: health.hippocampus },
  ];

  const allOk = items.every(i => i.status === 'ok');
  const hasError = items.some(i => i.status === 'error');

  return (
    <div className={cn(
      'rounded-xl px-4 py-3 mb-6 flex items-center justify-between',
      allOk ? 'bg-green-500/10 border border-green-500/30' :
      hasError ? 'bg-red-500/10 border border-red-500/30' :
      'bg-yellow-500/10 border border-yellow-500/30'
    )}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {allOk ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : hasError ? (
            <XCircle className="w-5 h-5 text-red-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          )}
          <span className={cn(
            'font-medium',
            allOk ? 'text-green-400' : hasError ? 'text-red-400' : 'text-yellow-400'
          )}>
            {allOk ? '系统正常' : hasError ? '系统异常' : '需要关注'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {items.map(item => (
            <div key={item.key} className="flex items-center gap-1.5">
              <div className={cn(
                'w-2 h-2 rounded-full',
                item.status === 'ok' ? 'bg-green-400' :
                item.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
              )} />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        {health.lastCheck.toLocaleTimeString()}
      </span>
    </div>
  );
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  const percent = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  
  if (diff === 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Minus className="w-3 h-3" />
        不变
      </span>
    );
  }
  
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-xs',
      diff > 0 ? 'text-green-400' : 'text-red-400'
    )}>
      {diff > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {diff > 0 ? '+' : ''}{diff}
      {percent !== 0 && ` (${percent > 0 ? '+' : ''}${percent}%)`}
    </span>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color,
  href,
  trend,
  badge
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  subValue?: string;
  color: 'purple' | 'blue' | 'green' | 'orange' | 'pink';
  href?: string;
  trend?: { current: number; previous: number };
  badge?: string;
}) {
  const colorMap = {
    purple: 'from-purple-600/20 to-purple-600/5 border-purple-600/30',
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-600/30',
    green: 'from-green-600/20 to-green-600/5 border-green-600/30',
    orange: 'from-orange-600/20 to-orange-600/5 border-orange-600/30',
    pink: 'from-pink-600/20 to-pink-600/5 border-pink-600/30',
  };
  const iconColorMap = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
  };

  const content = (
    <div className={cn(
      'bg-gradient-to-br rounded-2xl p-6 border transition-all',
      colorMap[color],
      href && 'hover:scale-[1.02] cursor-pointer'
    )}>
      <div className="flex items-center justify-between mb-4">
        <Icon className={cn('w-6 h-6', iconColorMap[color])} />
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300">
              {badge}
            </span>
          )}
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-bold text-white">{value}</div>
          {subValue && (
            <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{subValue}</div>
          )}
        </div>
        {trend && <TrendIndicator current={trend.current} previous={trend.previous} />}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatusResponse | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [health, setHealth] = useState<HealthStatus>({
    gateway: 'ok',
    cron: 'ok',
    memory: 'ok',
    hippocampus: 'ok',
    lastCheck: new Date(),
  });
  const [trends, setTrends] = useState<TrendData | null>(null);

  const baseUrl = typeof window !== 'undefined' 
    ? `http://${window.location.hostname}:18790`
    : 'http://localhost:18790';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, healthRes, hippoRes] = await Promise.all([
        fetch(`${baseUrl}/api/status`),
        fetch(`${baseUrl}/api/health`).catch(() => null),
        fetch(`${baseUrl}/api/memory/hippocampus`).catch(() => null),
      ]);

      if (!statusRes.ok) throw new Error('Failed to fetch status');
      const json = await statusRes.json();
      
      if (json.ok) {
        setData(json);
        setLastRefresh(new Date());
        
        // Mock trends (would come from API in production)
        setTrends({
          memoryFiles: { current: json.status.memoryFiles, previous: json.status.memoryFiles - 2 },
          skills: { current: json.status.skills, previous: json.status.skills },
          projects: { current: json.status.projects, previous: json.status.projects - 1 },
        });
      } else {
        throw new Error(json.error || 'Unknown error');
      }

      // Update health status
      const newHealth: HealthStatus = {
        gateway: 'ok',
        cron: 'ok',
        memory: json.status.memoryFiles > 0 ? 'ok' : 'warning',
        hippocampus: 'ok',
        lastCheck: new Date(),
      };

      if (healthRes?.ok) {
        const healthData = await healthRes.json();
        if (healthData.cron?.status === 'error') newHealth.cron = 'error';
        if (healthData.cron?.status === 'warning') newHealth.cron = 'warning';
      }

      if (hippoRes?.ok) {
        const hippoData = await hippoRes.json();
        if (!hippoData.ok || hippoData.totalMemories === 0) {
          newHealth.hippocampus = 'warning';
        }
      }

      setHealth(newHealth);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
      setHealth(prev => ({ ...prev, gateway: 'error', lastCheck: new Date() }));
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Keyboard shortcut: R to refresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        fetchData();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  // Categorize skills
  const builtinSkills = data?.skills?.filter(s => s.location?.includes('/node_modules/')) || [];
  const customSkills = data?.skills?.filter(s => !s.location?.includes('/node_modules/')) || [];

  // Recent memory files (today's)
  const today = new Date().toISOString().slice(0, 10);
  const todayMemories = data?.memoryFiles?.filter(f => f.modified?.startsWith(today)) || [];

  return (
    <Layout>
      <div className="p-8">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">仪表盘</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">
              系统运行状态概览
              {lastRefresh && (
                <span className="ml-2 text-xs">
                  · 最后更新: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:block">按 R 刷新</span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              <span className="text-sm">刷新</span>
            </button>
          </div>
        </div>

        {/* 健康状态横条 */}
        <HealthBar health={health} />

        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-200">
            连接错误: {error}
          </div>
        )}

        {/* 统计卡片 */}
        {loading && !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              icon={Brain}
              label="记忆文件"
              value={data?.status.memoryFiles || 0}
              color="pink"
              href="/memory"
              trend={trends?.memoryFiles}
              badge={todayMemories.length > 0 ? `今日+${todayMemories.length}` : undefined}
            />
            <StatCard
              icon={Zap}
              label="技能"
              value={data?.status.skills || 0}
              color="orange"
              href="/skills"
              trend={trends?.skills}
              subValue={`${builtinSkills.length} 内置 · ${customSkills.length} 自定义`}
            />
            <StatCard
              icon={FolderOpen}
              label="项目"
              value={data?.status.projects || 0}
              color="blue"
              href="/projects"
              trend={trends?.projects}
            />
            <StatCard
              icon={Radio}
              label="通道"
              value={data?.status.channels || 0}
              color="green"
            />
            <StatCard
              icon={Server}
              label="系统"
              value="在线"
              subValue={data?.status.workspace?.split('/').pop()}
              color="purple"
            />
          </div>
        )}

        {/* 主要内容 */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Claude 额度 */}
          <ClaudeUsageCard />
          
          {/* Token 统计 */}
          <TokenUsageCard />
          
          {/* 最近记忆 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Brain className="w-5 h-5 text-pink-400" />
                最近记忆
              </h2>
              <Link href="/memory" className="text-sm text-purple-400 hover:text-purple-300">
                查看全部 →
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {loading && !data ? (
                Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)
              ) : data?.memoryFiles?.length === 0 ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-4">暂无文件</div>
              ) : data?.memoryFiles?.slice(0, 5).map((file) => (
                <div key={file.name} className="flex items-center justify-between p-3 bg-[hsl(var(--secondary))] rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <span className="text-sm text-white">{file.name}</span>
                      {file.modified?.startsWith(today) && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">今日</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{file.modified}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 技能列表 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-400" />
                技能
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  ({customSkills.length} 自定义)
                </span>
              </h2>
              <Link href="/skills" className="text-sm text-purple-400 hover:text-purple-300">
                查看全部 →
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {loading && !data ? (
                Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)
              ) : data?.skills?.length === 0 ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-4">暂无技能</div>
              ) : (
                <>
                  {/* Show custom skills first */}
                  {customSkills.slice(0, 3).map((skill) => (
                    <div key={skill.name} className="flex items-center justify-between p-3 bg-[hsl(var(--secondary))] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <span className="text-sm text-white">{skill.name}</span>
                          <span className="ml-2 text-xs text-purple-400">自定义</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {builtinSkills.slice(0, 2).map((skill) => (
                    <div key={skill.name} className="flex items-center justify-between p-3 bg-[hsl(var(--secondary))] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-orange-400" />
                        </div>
                        <span className="text-sm text-white">{skill.name}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 项目列表 */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-400" />
                项目
              </h2>
              <Link href="/projects" className="text-sm text-purple-400 hover:text-purple-300">
                查看全部 →
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {loading && !data ? (
                Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)
              ) : data?.projects?.length === 0 ? (
                <div className="text-center text-[hsl(var(--muted-foreground))] py-4">暂无项目</div>
              ) : data?.projects?.slice(0, 5).map((project) => (
                <div key={project.name} className="flex items-center justify-between p-3 bg-[hsl(var(--secondary))] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <FolderOpen className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white">{project.name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{project.language}</div>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{project.modified}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/config" className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 hover:border-purple-600/50 transition-all">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-400" />
              <span className="font-medium">配置文件</span>
            </div>
          </Link>
          <Link href="/prompts" className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 hover:border-purple-600/50 transition-all">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-yellow-400" />
              <span className="font-medium">提示词</span>
            </div>
          </Link>
          <Link href="/output" className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 hover:border-purple-600/50 transition-all">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="font-medium">输出文件</span>
            </div>
          </Link>
          <Link href="/settings" className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 hover:border-purple-600/50 transition-all">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="font-medium">设置</span>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
