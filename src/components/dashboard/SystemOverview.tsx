'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { Server, Cpu, HardDrive, Clock } from 'lucide-react';

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

export function SystemOverview() {
  const { connected, status, metrics } = useGatewayStore();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="w-5 h-5" />
          系统概览
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gateway Status */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <Badge variant={connected ? 'default' : 'destructive'} className="mb-2">
              {connected ? '✓ Gateway' : '× 离线'}
            </Badge>
            <span className="text-xs text-muted-foreground">运行中</span>
          </div>

          {/* CPU */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-bold">{metrics?.cpu ?? 0}%</span>
            </div>
            <span className="text-xs text-muted-foreground">CPU 占用</span>
          </div>

          {/* Memory */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-bold">
                {metrics?.memory.used ? `${Math.round(metrics.memory.used / 1024 / 1024)}MB` : '-'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">内存占用</span>
          </div>

          {/* Uptime */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{formatUptime(status?.uptime)}</span>
            </div>
            <span className="text-xs text-muted-foreground">运行时间</span>
          </div>
        </div>

        {/* Host Info */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">主机：</span>
              <span className="ml-1">{status?.host || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">系统：</span>
              <span className="ml-1">{status?.os || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">版本：</span>
              <span className="ml-1">{status?.version || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Node：</span>
              <span className="ml-1">{status?.node || '-'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
