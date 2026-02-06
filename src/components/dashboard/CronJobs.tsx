'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Timer,
  RefreshCw
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { getGateway } from '@/lib/websocket';
import { useGatewayStore } from '@/stores/gateway';

interface CronJob {
  id: string;
  name?: string;
  enabled: boolean;
  schedule: {
    kind: string;
    expr?: string;
    tz?: string;
  };
  state?: {
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastStatus?: 'ok' | 'error';
    lastError?: string;
    lastDurationMs?: number;
  };
}

function formatSchedule(schedule: CronJob['schedule']): string {
  if (schedule.kind === 'cron' && schedule.expr) {
    // Parse common cron expressions
    const expr = schedule.expr;
    if (expr === '0 * * * *') return '每小时';
    if (expr === '0 */6 * * *') return '每6小时';
    if (expr.match(/^0 \d+ \* \* \*$/)) {
      const hour = expr.split(' ')[1];
      return `每天 ${hour}:00`;
    }
    if (expr.match(/^\d+ \d+ \* \* \*$/)) {
      const parts = expr.split(' ');
      return `每天 ${parts[1]}:${parts[0].padStart(2, '0')}`;
    }
    return expr;
  }
  return schedule.kind;
}

function formatRelativeTime(ms?: number): string {
  if (!ms) return '-';
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  
  if (absDiff < 60000) return diff > 0 ? '即将' : '刚刚';
  if (absDiff < 3600000) {
    const mins = Math.floor(absDiff / 60000);
    return diff > 0 ? `${mins}分钟后` : `${mins}分钟前`;
  }
  const hours = Math.floor(absDiff / 3600000);
  return diff > 0 ? `${hours}小时后` : `${hours}小时前`;
}

export function CronJobs() {
  const { connected } = useGatewayStore();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const gateway = getGateway();
      const result = await gateway.call<{ jobs?: CronJob[] }>('cron.list', { 
        includeDisabled: true 
      });
      setJobs(result?.jobs || []);
    } catch (err) {
      console.error('Failed to fetch cron jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchJobs();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const runJob = async (jobId: string) => {
    if (!connected) return;
    
    setRunningJob(jobId);
    try {
      const gateway = getGateway();
      await gateway.call('cron.run', { jobId });
      // Refresh after running
      setTimeout(fetchJobs, 1000);
    } catch (err) {
      console.error('Failed to run job:', err);
    } finally {
      setRunningJob(null);
    }
  };

  const enabledJobs = jobs.filter(j => j.enabled);
  const okCount = jobs.filter(j => j.state?.lastStatus === 'ok').length;
  const errorCount = jobs.filter(j => j.state?.lastStatus === 'error').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Cron 任务
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchJobs}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <span>{enabledJobs.length} 个任务</span>
          </div>
          {okCount > 0 && (
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span>{okCount} 成功</span>
            </div>
          )}
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="w-4 h-4" />
              <span>{errorCount} 失败</span>
            </div>
          )}
        </div>

        {/* Job List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`p-3 rounded-lg border transition-colors ${
                job.enabled ? 'bg-card hover:bg-accent/50' : 'bg-muted/30 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {job.enabled ? (
                    <Play className="w-4 h-4 text-green-500" />
                  ) : (
                    <Pause className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm truncate max-w-[150px]">
                    {job.name || job.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {job.state?.lastStatus && (
                    <Badge 
                      variant={job.state.lastStatus === 'ok' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {job.state.lastStatus === 'ok' ? '成功' : '失败'}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runJob(job.id)}
                    disabled={!connected || runningJob === job.id || !job.enabled}
                    className="h-6 w-6 p-0"
                  >
                    <Play className={`w-3 h-3 ${runningJob === job.id ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatSchedule(job.schedule)}</span>
                </div>
                <div className="text-right">
                  下次: {formatRelativeTime(job.state?.nextRunAtMs)}
                </div>
              </div>

              {job.state?.lastError && (
                <div className="mt-2 text-xs text-red-400 truncate">
                  {job.state.lastError}
                </div>
              )}
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {connected ? (loading ? '加载中...' : '暂无 Cron 任务') : '未连接'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
