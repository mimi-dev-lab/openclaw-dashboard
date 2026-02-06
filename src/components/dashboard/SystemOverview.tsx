'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { getGateway } from '@/lib/websocket';
import { Server, Cpu, HardDrive, Clock, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface SystemInfo {
  pid?: number;
  uptime?: number;
  os?: string;
  arch?: string;
  nodeVersion?: string;
  version?: string;
  host?: string;
  memory?: {
    used: number;
    total: number;
    percent: number;
  };
  cpu?: number;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}天${hours % 24}小时`;
  }
  return `${hours}小时${minutes}分钟`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function SystemOverview() {
  const { connected } = useGatewayStore();
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({});
  const [loading, setLoading] = useState(false);

  const fetchSystemInfo = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const gateway = getGateway();
      
      // Fetch status
      const statusResult = await gateway.call<{
        version?: string;
        uptime?: number;
        host?: string;
        os?: string;
        arch?: string;
        nodeVersion?: string;
        pid?: number;
      }>('status');
      
      // Fetch health for additional metrics
      const healthResult = await gateway.call<{
        ok?: boolean;
        durationMs?: number;
        memory?: { heapUsed?: number; heapTotal?: number; rss?: number };
      }>('health');
      
      const memUsed = healthResult?.memory?.rss || healthResult?.memory?.heapUsed || 0;
      const memTotal = healthResult?.memory?.heapTotal || 0;
      
      setSystemInfo({
        pid: statusResult?.pid,
        uptime: statusResult?.uptime,
        os: statusResult?.os,
        arch: statusResult?.arch,
        nodeVersion: statusResult?.nodeVersion,
        version: statusResult?.version,
        host: statusResult?.host,
        memory: memTotal > 0 ? {
          used: memUsed,
          total: memTotal,
          percent: Math.round((memUsed / memTotal) * 100)
        } : undefined,
        cpu: undefined // CPU not directly available
      });
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchSystemInfo();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSystemInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemInfo]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="w-5 h-5" />
          系统概览
          {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gateway Status */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <Badge variant={connected ? 'default' : 'destructive'} className="mb-2">
              {connected ? '✓ Gateway' : '× 离线'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {systemInfo.pid ? `PID: ${systemInfo.pid}` : '运行中'}
            </span>
          </div>

          {/* CPU */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-bold">
                {systemInfo.cpu !== undefined ? `${systemInfo.cpu}%` : '-'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">CPU 占用</span>
          </div>

          {/* Memory */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-bold">
                {systemInfo.memory ? formatBytes(systemInfo.memory.used) : '-'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {systemInfo.memory 
                ? `内存 ${systemInfo.memory.percent}%` 
                : '内存占用'}
            </span>
          </div>

          {/* Uptime */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{formatUptime(systemInfo.uptime)}</span>
            </div>
            <span className="text-xs text-muted-foreground">运行时间</span>
          </div>
        </div>

        {/* Host Info */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">主机：</span>
              <span className="ml-1">{systemInfo.host || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">系统：</span>
              <span className="ml-1">
                {systemInfo.os && systemInfo.arch 
                  ? `${systemInfo.os} (${systemInfo.arch})`
                  : '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">版本：</span>
              <span className="ml-1">{systemInfo.version || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Node：</span>
              <span className="ml-1">{systemInfo.nodeVersion || '-'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
