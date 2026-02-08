'use client';

import { Layout } from '@/components/Layout';
import { Clock, Play, Pause, Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Plus, X, History, FileText, Bot, Terminal, ChevronRight, Zap, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CronJob {
  id: string;
  name?: string;
  schedule: {
    kind: 'cron' | 'every' | 'at';
    expr?: string;
    everyMs?: number;
    at?: string;
    tz?: string;
  };
  enabled: boolean;
  sessionTarget?: string;
  payload?: {
    kind?: string;
    text?: string;
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

interface CronRunEntry {
  ts: number;
  jobId: string;
  status: 'ok' | 'error';
  summary?: string;
  runAtMs: number;
  durationMs: number;
  sessionKey?: string;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | { type: string; text?: string; thinking?: string }[];
  timestamp?: number;
}

function parseCronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [minute, hour, day, month, weekday] = parts;
  
  if (minute.startsWith('*/') && hour === '*') return `每 ${minute.slice(2)} 分钟`;
  if (minute === '0' && hour.startsWith('*/')) return `每 ${hour.slice(2)} 小时`;
  if (minute === '0' && hour === '*') return '每小时整点';
  if (hour === '*') return `每小时 ${minute} 分`;
  if (day === '*' && month === '*' && weekday === '*' && hour !== '*') {
    const h = parseInt(hour), m = parseInt(minute);
    if (!isNaN(h) && !isNaN(m)) return `每天 ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }
  if (day === '*' && month === '*' && weekday !== '*') {
    const h = parseInt(hour), m = parseInt(minute);
    const days = ['日','一','二','三','四','五','六'];
    return `每周${days[parseInt(weekday)] || weekday} ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }
  return expr;
}

function formatSchedule(schedule: CronJob['schedule']): string {
  if (schedule.kind === 'cron' && schedule.expr) return parseCronToHuman(schedule.expr);
  if (schedule.kind === 'every' && schedule.everyMs) {
    const mins = schedule.everyMs / 60000;
    return mins >= 60 ? `每 ${Math.round(mins/60)} 小时` : `每 ${mins} 分钟`;
  }
  return schedule.kind;
}

function formatRelativeTime(ms?: number): string {
  if (!ms) return '-';
  const diff = Date.now() - ms;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff/60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)} 小时前`;
  return `${Math.floor(diff/86400000)} 天前`;
}

function formatTime(ms?: number): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// 任务卡片
function JobCard({ job, onSelect, onRun, onToggle, isRunning }: {
  job: CronJob;
  onSelect: () => void;
  onRun: () => void;
  onToggle: () => void;
  isRunning: boolean;
}) {
  const isFailed = job.state?.lastStatus === 'error';
  const isSuccess = job.state?.lastStatus === 'ok';
  
  return (
    <div 
      onClick={onSelect}
      className={cn(
        'group relative p-4 rounded-xl border cursor-pointer transition-all',
        'hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10',
        isFailed ? 'bg-red-500/5 border-red-500/30' : 'bg-[hsl(var(--card))] border-[hsl(var(--border))]',
        !job.enabled && 'opacity-60'
      )}
    >
      {/* 状态指示条 */}
      <div className={cn(
        'absolute left-0 top-4 bottom-4 w-1 rounded-full',
        isFailed ? 'bg-red-500' : isSuccess ? 'bg-green-500' : job.enabled ? 'bg-amber-500' : 'bg-gray-500'
      )} />
      
      <div className="pl-4">
        {/* 头部：名称 + 快捷操作 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{job.name || job.id.slice(0,8)}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                {formatSchedule(job.schedule)}
              </span>
              {!job.enabled && (
                <span className="text-xs text-gray-400 bg-gray-500/20 px-2 py-0.5 rounded">已暂停</span>
              )}
            </div>
          </div>
          
          {/* 快捷操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              disabled={isRunning || !job.enabled}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'bg-green-500/10 text-green-400 hover:bg-green-500/20',
                (isRunning || !job.enabled) && 'opacity-50 cursor-not-allowed'
              )}
              title="立即运行"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                job.enabled 
                  ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              )}
              title={job.enabled ? '暂停' : '启用'}
            >
              {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* 状态信息 */}
        <div className="flex items-center gap-4 mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          {isSuccess && (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle className="w-3 h-3" /> 成功
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="w-3 h-3" /> 失败
            </span>
          )}
          <span>上次: {formatRelativeTime(job.state?.lastRunAtMs)}</span>
          {job.state?.lastDurationMs && (
            <span>{(job.state.lastDurationMs/1000).toFixed(1)}s</span>
          )}
        </div>
        
        {/* 错误提示 */}
        {isFailed && job.state?.lastError && (
          <div className="mt-2 text-xs text-red-400 truncate">
            ⚠️ {job.state.lastError}
          </div>
        )}
      </div>
      
      {/* 展开箭头 */}
      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// 详情侧边栏
function DetailDrawer({ job, onClose, onRun, onToggle, onDelete, isRunning }: {
  job: CronJob | null;
  onClose: () => void;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isRunning: boolean;
}) {
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRun, setSelectedRun] = useState<CronRunEntry | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (job) {
      setLoadingRuns(true);
      setSelectedRun(null);
      setMessages([]);
      const baseUrl = `http://${window.location.hostname}:18790`;
      fetch(`${baseUrl}/api/cron/runs?jobId=${encodeURIComponent(job.id)}`)
        .then(res => res.json())
        .then(data => { setRuns(data.entries || []); setLoadingRuns(false); })
        .catch(() => setLoadingRuns(false));
    }
  }, [job?.id]);

  useEffect(() => {
    if (selectedRun?.sessionKey) {
      setLoadingMessages(true);
      const baseUrl = `http://${window.location.hostname}:18790`;
      fetch(`${baseUrl}/api/sessions/history?key=${encodeURIComponent(selectedRun.sessionKey)}&limit=20`)
        .then(res => res.json())
        .then(data => { setMessages(data.messages || []); setLoadingMessages(false); })
        .catch(() => setLoadingMessages(false));
    }
  }, [selectedRun?.sessionKey]);

  if (!job) return null;

  const isFailed = job.state?.lastStatus === 'error';

  const formatContent = (content: SessionMessage['content']) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((part, i) => {
        if (part.type === 'text' && part.text) return <div key={i}>{part.text}</div>;
        if (part.type === 'thinking' && part.thinking) {
          return <div key={i} className="text-gray-500 italic text-xs mt-1">💭 {part.thinking.slice(0,150)}...</div>;
        }
        return null;
      });
    }
    return JSON.stringify(content);
  };

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      
      {/* 侧边栏 */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[hsl(var(--background))] border-l border-[hsl(var(--border))] z-50 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="font-bold text-lg text-white">{job.name || job.id.slice(0,8)}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{formatSchedule(job.schedule)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))]">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2 p-4 border-b border-[hsl(var(--border))]">
          <button
            onClick={onRun}
            disabled={isRunning || !job.enabled}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            立即运行
          </button>
          <button
            onClick={onToggle}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
              job.enabled 
                ? 'bg-yellow-600 hover:bg-yellow-500'
                : 'bg-purple-600 hover:bg-purple-500'
            )}
          >
            {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {job.enabled ? '暂停' : '启用'}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center px-4 py-2.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {/* 状态卡片 */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">状态</div>
                <div className={cn('font-medium mt-1', isFailed ? 'text-red-400' : 'text-green-400')}>
                  {isFailed ? '执行失败' : job.state?.lastStatus === 'ok' ? '执行成功' : '等待中'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">下次执行</div>
                <div className="font-medium mt-1 text-white">{formatTime(job.state?.nextRunAtMs)}</div>
              </div>
            </div>
            
            {/* Payload */}
            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">任务内容</div>
              <pre className="text-xs text-white whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {job.payload?.message || job.payload?.text || '-'}
              </pre>
            </div>
            
            {/* 错误信息 */}
            {isFailed && job.state?.lastError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="text-xs text-red-400 mb-1">错误信息</div>
                <div className="text-sm text-red-300">{job.state.lastError}</div>
              </div>
            )}
          </div>
          
          {/* 执行历史 */}
          <div className="border-t border-[hsl(var(--border))]">
            <div className="p-4">
              <h3 className="font-medium text-white flex items-center gap-2">
                <History className="w-4 h-4" /> 执行历史
              </h3>
            </div>
            
            {loadingRuns ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">暂无执行记录</div>
            ) : (
              <div className="px-4 pb-4 space-y-2">
                {runs.slice(0, 15).map((run, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedRun(selectedRun?.ts === run.ts ? null : run)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg transition-colors',
                      selectedRun?.ts === run.ts 
                        ? 'bg-purple-500/20 border border-purple-500/50' 
                        : 'bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        run.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                      )} />
                      <span className="text-sm text-white">{formatTime(run.runAtMs)}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {(run.durationMs/1000).toFixed(1)}s
                      </span>
                    </div>
                    {run.summary && (
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1 truncate pl-5">
                        {run.summary}
                      </div>
                    )}
                    
                    {/* 展开的日志 */}
                    {selectedRun?.ts === run.ts && (
                      <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                        {loadingMessages ? (
                          <div className="flex justify-center py-4">
                            <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">无日志</div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {messages.map((msg, i) => (
                              <div key={i} className={cn(
                                'p-2 rounded text-xs',
                                msg.role === 'user' ? 'bg-purple-500/10' : 'bg-[hsl(var(--card))]'
                              )}>
                                <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] mb-1">
                                  {msg.role === 'user' ? <Terminal className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                  {msg.role === 'user' ? 'Task' : 'Agent'}
                                </div>
                                <div className="text-white whitespace-pre-wrap break-words">
                                  {formatContent(msg.content)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'active' | 'failed'>('all');

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      const res = await fetch(`${baseUrl}/api/cron`);
      const data = await res.json();
      if (data.ok) setJobs(data.jobs || []);
      else setError(data.error);
    } catch { setError('连接失败'); }
    finally { setLoading(false); }
  };

  const handleRun = async (job: CronJob) => {
    setRunningJobs(prev => new Set(prev).add(job.id));
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      await fetch(`${baseUrl}/api/cron/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', jobId: job.id }),
      });
      setTimeout(fetchJobs, 2000);
    } finally {
      setRunningJobs(prev => { const n = new Set(prev); n.delete(job.id); return n; });
    }
  };

  const handleToggle = async (job: CronJob) => {
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      await fetch(`${baseUrl}/api/cron/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', jobId: job.id, enabled: !job.enabled }),
      });
      fetchJobs();
      if (selectedJob?.id === job.id) setSelectedJob({ ...job, enabled: !job.enabled });
    } catch {}
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`确定要删除 "${job.name || job.id}" 吗？`)) return;
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      await fetch(`${baseUrl}/api/cron/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId: job.id }),
      });
      setSelectedJob(null);
      fetchJobs();
    } catch {}
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'active') return job.enabled;
    if (filter === 'failed') return job.state?.lastStatus === 'error';
    return true;
  }).sort((a, b) => {
    if (a.state?.lastStatus === 'error' && b.state?.lastStatus !== 'error') return -1;
    if (b.state?.lastStatus === 'error' && a.state?.lastStatus !== 'error') return 1;
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    return 0;
  });

  const stats = {
    total: jobs.length,
    active: jobs.filter(j => j.enabled).length,
    failed: jobs.filter(j => j.state?.lastStatus === 'error').length,
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">定时任务</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">自动化任务管理</p>
          </div>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'p-4 rounded-xl text-left transition-all',
              filter === 'all' 
                ? 'bg-purple-500/20 border-2 border-purple-500' 
                : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-purple-500/50'
            )}
          >
            <Calendar className="w-5 h-5 text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">全部任务</div>
          </button>
          <button
            onClick={() => setFilter('active')}
            className={cn(
              'p-4 rounded-xl text-left transition-all',
              filter === 'active' 
                ? 'bg-green-500/20 border-2 border-green-500' 
                : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-green-500/50'
            )}
          >
            <CheckCircle className="w-5 h-5 text-green-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.active}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">运行中</div>
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={cn(
              'p-4 rounded-xl text-left transition-all',
              filter === 'failed' 
                ? 'bg-red-500/20 border-2 border-red-500' 
                : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-red-500/50'
            )}
          >
            <XCircle className="w-5 h-5 text-red-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.failed}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">执行失败</div>
          </button>
        </div>

        {/* 失败警告 */}
        {stats.failed > 0 && filter !== 'failed' && (
          <button
            onClick={() => setFilter('failed')}
            className="w-full flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">有 {stats.failed} 个任务执行失败，点击查看</span>
          </button>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* 任务列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
            {filter === 'failed' ? '没有失败的任务 🎉' : '暂无任务'}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onSelect={() => setSelectedJob(job)}
                onRun={() => handleRun(job)}
                onToggle={() => handleToggle(job)}
                isRunning={runningJobs.has(job.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 详情抽屉 */}
      <DetailDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onRun={() => selectedJob && handleRun(selectedJob)}
        onToggle={() => selectedJob && handleToggle(selectedJob)}
        onDelete={() => selectedJob && handleDelete(selectedJob)}
        isRunning={selectedJob ? runningJobs.has(selectedJob.id) : false}
      />
    </Layout>
  );
}
