'use client';

import { Layout } from '@/components/Layout';
import { Clock, Play, Pause, Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Plus, X, History, FileText, Bot, Terminal } from 'lucide-react';
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
  action: string;
  status: 'ok' | 'error';
  summary?: string;
  runAtMs: number;
  durationMs: number;
  sessionKey?: string;
  error?: string;
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
  
  // 每 N 分钟: */N * * * *
  if (minute.startsWith('*/') && hour === '*') {
    const interval = parseInt(minute.slice(2));
    return `每 ${interval} 分钟`;
  }
  
  // 每 N 小时: 0 */N * * *
  if (minute === '0' && hour.startsWith('*/')) {
    const interval = parseInt(hour.slice(2));
    return `每 ${interval} 小时`;
  }
  
  // 每小时整点: 0 * * * *
  if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return '每小时整点';
  }
  
  // 每小时 N 分: N * * * *
  if (hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return `每小时 ${minute} 分`;
  }
  
  // 每天特定时间: M H * * *
  if (day === '*' && month === '*' && weekday === '*' && hour !== '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    if (!isNaN(h) && !isNaN(m)) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      return `每天 ${timeStr}`;
    }
  }
  
  if (day === '*' && month === '*' && weekday !== '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const dayName = days[parseInt(weekday)] || weekday;
    return `每周${dayName} ${timeStr}`;
  }
  
  if (month === '*' && weekday === '*' && day !== '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    return `每月 ${day} 日 ${timeStr}`;
  }
  
  return expr;
}

function formatSchedule(schedule: CronJob['schedule']): string {
  if (schedule.kind === 'cron' && schedule.expr) {
    return parseCronToHuman(schedule.expr);
  }
  if (schedule.kind === 'every' && schedule.everyMs) {
    const mins = schedule.everyMs / 60000;
    if (mins >= 60) return `每 ${Math.round(mins / 60)} 小时`;
    return `每 ${mins} 分钟`;
  }
  if (schedule.kind === 'at' && schedule.at) {
    const date = new Date(schedule.at);
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (schedule.kind === 'at') return '一次性';
  return '-';
}

function formatTime(ms?: number): string {
  if (!ms) return '-';
  const date = new Date(ms);
  return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// 执行日志 Modal
function LogModal({ 
  isOpen, 
  onClose, 
  sessionKey,
  runEntry,
}: { 
  isOpen: boolean;
  onClose: () => void;
  sessionKey: string;
  runEntry: CronRunEntry | null;
}) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && sessionKey) {
      setIsLoading(true);
      const baseUrl = `http://${window.location.hostname}:18790`;
      fetch(`${baseUrl}/api/sessions/history?key=${encodeURIComponent(sessionKey)}&limit=20`)
        .then(res => res.json())
        .then(data => {
          setMessages(data.messages || []);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [isOpen, sessionKey]);

  if (!isOpen) return null;

  const formatContent = (content: SessionMessage['content']) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((part, i) => {
        if (part.type === 'text' && part.text) {
          return <div key={i}>{part.text}</div>;
        }
        if (part.type === 'thinking' && part.thinking) {
          return (
            <div key={i} className="text-[hsl(var(--muted-foreground))] italic border-l-2 border-[hsl(var(--border))] pl-3 my-2">
              💭 {part.thinking.slice(0, 200)}...
            </div>
          );
        }
        return null;
      });
    }
    return JSON.stringify(content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', 
              runEntry?.status === 'ok' ? 'bg-green-500/20' : 'bg-red-500/20'
            )}>
              <FileText className={cn('w-4 h-4', runEntry?.status === 'ok' ? 'text-green-400' : 'text-red-400')} />
            </div>
            <div>
              <h2 className="font-bold text-white">执行日志</h2>
              {runEntry && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {new Date(runEntry.runAtMs).toLocaleString('zh-CN')} · 耗时 {(runEntry.durationMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
            <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              没有找到日志记录
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={cn('p-4 rounded-xl', 
                  msg.role === 'user' ? 'bg-purple-500/10 border border-purple-500/30' : 
                  msg.role === 'assistant' ? 'bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]' :
                  'bg-amber-500/10 border border-amber-500/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {msg.role === 'user' ? (
                      <Terminal className="w-4 h-4 text-purple-400" />
                    ) : msg.role === 'assistant' ? (
                      <Bot className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">
                      {msg.role === 'user' ? 'Task' : msg.role === 'assistant' ? 'Agent' : 'System'}
                    </span>
                    {msg.timestamp && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white whitespace-pre-wrap break-words font-mono">
                    {formatContent(msg.content)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {runEntry?.summary && (
          <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Summary:</span>
              <code className="text-xs text-white bg-[hsl(var(--card))] px-2 py-1 rounded">
                {runEntry.summary}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 执行历史面板
function RunHistory({ 
  jobId, 
  isExpanded,
  onViewLog,
}: { 
  jobId: string;
  isExpanded: boolean;
  onViewLog: (entry: CronRunEntry) => void;
}) {
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      setIsLoading(true);
      const baseUrl = `http://${window.location.hostname}:18790`;
      fetch(`${baseUrl}/api/cron/runs?jobId=${encodeURIComponent(jobId)}`)
        .then(res => res.json())
        .then(data => {
          // 接口返回的是 entries 而不是 runs
          setRuns(data.entries || data.runs || []);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [isExpanded, jobId]);

  if (!isExpanded) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">最近执行记录</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">暂无执行记录</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {runs.slice(0, 10).map((run, idx) => (
            <button
              key={idx}
              onClick={() => onViewLog(run)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left"
            >
              <div className={cn('w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
                run.status === 'ok' ? 'bg-green-500/20' : 'bg-red-500/20'
              )}>
                {run.status === 'ok' ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white">
                    {new Date(run.runAtMs).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                {run.summary && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                    {run.summary}
                  </p>
                )}
              </div>
              <FileText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CronJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showNewJob, setShowNewJob] = useState(false);
  const [logModal, setLogModal] = useState<{
    isOpen: boolean;
    sessionKey: string;
    runEntry: CronRunEntry | null;
  }>({ isOpen: false, sessionKey: '', runEntry: null });
  const [newJob, setNewJob] = useState({
    name: '',
    scheduleKind: 'cron' as 'cron' | 'every',
    cronExpr: '0 9 * * *',
    everyMins: 60,
    message: '',
    sessionTarget: 'isolated' as 'main' | 'isolated',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      const res = await fetch(`${baseUrl}/api/cron`);
      const data = await res.json();
      if (data.ok) {
        setJobs(data.jobs || []);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('连接失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'run' | 'toggle' | 'remove', job: CronJob) => {
    if (action === 'remove') {
      setDeleteConfirm(job);
      return;
    }
    
    setActionLoading(job.id);
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      const res = await fetch(`${baseUrl}/api/cron/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobId: job.id, enabled: !job.enabled }),
      });
      const data = await res.json();
      
      if (data.ok) {
        fetchJobs();
      } else {
        alert('操作失败: ' + data.error);
      }
    } catch (e) {
      alert('操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (job: CronJob) => {
    setActionLoading(job.id);
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      const res = await fetch(`${baseUrl}/api/cron/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId: job.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setJobs(jobs.filter(j => j.id !== job.id));
        setDeleteConfirm(null);
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (e) {
      alert('删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  const handleViewLog = (entry: CronRunEntry) => {
    if (entry.sessionKey) {
      setLogModal({
        isOpen: true,
        sessionKey: entry.sessionKey,
        runEntry: entry,
      });
    }
  };

  const handleCreateJob = async () => {
    if (!newJob.name || !newJob.message) {
      alert('请填写任务名称和消息内容');
      return;
    }
    
    setCreating(true);
    try {
      const baseUrl = `http://${window.location.hostname}:18790`;
      
      const job: any = {
        name: newJob.name,
        sessionTarget: newJob.sessionTarget,
        payload: newJob.sessionTarget === 'isolated' 
          ? { kind: 'agentTurn', message: newJob.message }
          : { kind: 'systemEvent', text: newJob.message },
        enabled: true,
      };
      
      if (newJob.scheduleKind === 'cron') {
        job.schedule = { kind: 'cron', expr: newJob.cronExpr, tz: 'Asia/Tokyo' };
      } else {
        job.schedule = { kind: 'every', everyMs: newJob.everyMins * 60 * 1000 };
      }
      
      const res = await fetch(`${baseUrl}/api/cron/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      
      const data = await res.json();
      if (data.ok) {
        setShowNewJob(false);
        setNewJob({
          name: '',
          scheduleKind: 'cron',
          cronExpr: '0 9 * * *',
          everyMins: 60,
          message: '',
          sessionTarget: 'isolated',
        });
        fetchJobs();
      } else {
        alert('创建失败: ' + data.error);
      }
    } catch (e) {
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  const enabledJobs = jobs.filter(j => j.enabled);
  const disabledJobs = jobs.filter(j => !j.enabled);

  return (
    <Layout>
      <div className="p-8">
        {/* Log Modal */}
        <LogModal
          isOpen={logModal.isOpen}
          onClose={() => setLogModal({ isOpen: false, sessionKey: '', runEntry: null })}
          sessionKey={logModal.sessionKey}
          runEntry={logModal.runEntry}
        />

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">定时任务</h1>
            <p className="text-[hsl(var(--muted-foreground))] mt-1">{jobs.length} 个任务</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewJob(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">新建任务</span>
            </button>
            <button
              onClick={() => fetchJobs()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              <span className="text-sm">刷新</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-white">{jobs.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">总任务</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-green-400">{enabledJobs.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">运行中</div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl p-4 border border-[hsl(var(--border))]">
            <div className="text-2xl font-bold text-gray-400">{disabledJobs.length}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">已暂停</div>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[hsl(var(--secondary))]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">任务</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">调度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">上次执行</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">下次执行</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase w-32">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">加载中...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">暂无定时任务</td></tr>
              ) : jobs.map((job) => (
                <>
                  <tr key={job.id} className="hover:bg-[hsl(var(--secondary))] transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-2 h-2 rounded-full', job.enabled ? 'bg-green-500' : 'bg-gray-500')} />
                        <div>
                          <div className="font-medium text-white">{job.name || job.id.slice(0, 8)}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            {job.payload?.kind || '-'} → {job.sessionTarget || 'main'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{formatSchedule(job.schedule)}</span>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {job.schedule.kind === 'cron' && job.schedule.expr ? job.schedule.expr : job.schedule.kind}
                        {job.schedule.tz && ` (${job.schedule.tz})`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {job.state?.lastStatus === 'ok' && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" /> 成功
                        </span>
                      )}
                      {job.state?.lastStatus === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <XCircle className="w-3 h-3" /> 失败
                        </span>
                      )}
                      {!job.state?.lastStatus && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatTime(job.state?.lastRunAtMs)}
                      </div>
                      {job.state?.lastDurationMs && (
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          耗时 {formatDuration(job.state.lastDurationMs)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatTime(job.state?.nextRunAtMs)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAction('run', job)}
                          disabled={actionLoading === job.id}
                          className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-green-400 hover:bg-green-500/10 transition-colors"
                          title="立即执行"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAction('toggle', job)}
                          disabled={actionLoading === job.id}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            job.enabled 
                              ? 'text-[hsl(var(--muted-foreground))] hover:text-yellow-400 hover:bg-yellow-500/10'
                              : 'text-[hsl(var(--muted-foreground))] hover:text-green-400 hover:bg-green-500/10'
                          )}
                          title={job.enabled ? '暂停' : '启用'}
                        >
                          {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => toggleExpand(job.id)}
                          className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="详情"
                        >
                          {expandedJob === job.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleAction('remove', job)}
                          disabled={actionLoading === job.id}
                          className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedJob === job.id && (
                    <tr key={`${job.id}-detail`}>
                      <td colSpan={6} className="px-4 py-3 bg-[hsl(var(--secondary))]">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Payload</div>
                            <div className="text-white text-xs bg-[hsl(var(--card))] p-2 rounded max-h-32 overflow-auto">
                              <pre className="whitespace-pre-wrap">{job.payload?.message || job.payload?.text || '-'}</pre>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">最后错误</div>
                            <div className="text-xs text-red-400 bg-[hsl(var(--card))] p-2 rounded max-h-32 overflow-auto">
                              {job.state?.lastError || '无'}
                            </div>
                          </div>
                        </div>
                        {/* Run History */}
                        <RunHistory 
                          jobId={job.id} 
                          isExpanded={expandedJob === job.id}
                          onViewLog={handleViewLog}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">删除定时任务</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">此操作不可恢复</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
              确定要删除任务 <span className="font-semibold text-white">{deleteConfirm.name || deleteConfirm.id.slice(0, 8)}</span> 吗？
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors">
                取消
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={actionLoading === deleteConfirm.id} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm transition-colors disabled:opacity-50">
                {actionLoading === deleteConfirm.id ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Job Modal */}
      {showNewJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-white text-lg">新建定时任务</h3>
              <button onClick={() => setShowNewJob(false)} className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg">
                <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">任务名称</label>
                <input
                  type="text"
                  value={newJob.name}
                  onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                  placeholder="例如：每日提醒"
                  className="w-full px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">调度类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewJob({ ...newJob, scheduleKind: 'cron' })}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm transition-colors',
                      newJob.scheduleKind === 'cron' ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                    )}
                  >
                    Cron 表达式
                  </button>
                  <button
                    onClick={() => setNewJob({ ...newJob, scheduleKind: 'every' })}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm transition-colors',
                      newJob.scheduleKind === 'every' ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                    )}
                  >
                    固定间隔
                  </button>
                </div>
              </div>
              
              {newJob.scheduleKind === 'cron' ? (
                <div>
                  <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Cron 表达式</label>
                  <input
                    type="text"
                    value={newJob.cronExpr}
                    onChange={(e) => setNewJob({ ...newJob, cronExpr: e.target.value })}
                    placeholder="0 9 * * *"
                    className="w-full px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-white font-mono placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    格式：分 时 日 月 周。例如 "0 9 * * *" = 每天 9:00
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">间隔（分钟）</label>
                  <input
                    type="number"
                    value={newJob.everyMins}
                    onChange={(e) => setNewJob({ ...newJob, everyMins: parseInt(e.target.value) || 60 })}
                    min={1}
                    className="w-full px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">目标会话</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewJob({ ...newJob, sessionTarget: 'isolated' })}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm transition-colors',
                      newJob.sessionTarget === 'isolated' ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                    )}
                  >
                    Isolated（独立执行）
                  </button>
                  <button
                    onClick={() => setNewJob({ ...newJob, sessionTarget: 'main' })}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm transition-colors',
                      newJob.sessionTarget === 'main' ? 'bg-purple-600 text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                    )}
                  >
                    Main（系统事件）
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">
                  {newJob.sessionTarget === 'isolated' ? '任务提示词' : '系统事件文本'}
                </label>
                <textarea
                  value={newJob.message}
                  onChange={(e) => setNewJob({ ...newJob, message: e.target.value })}
                  placeholder={newJob.sessionTarget === 'isolated' ? '描述要执行的任务...' : '系统事件消息...'}
                  rows={3}
                  className="w-full px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowNewJob(false)} className="px-4 py-2 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--border))] rounded-lg text-sm transition-colors">
                取消
              </button>
              <button onClick={handleCreateJob} disabled={creating} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50">
                {creating ? '创建中...' : '创建任务'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
