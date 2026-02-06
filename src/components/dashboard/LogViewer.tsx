'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Terminal, 
  Trash2, 
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug
} from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getGateway } from '@/lib/websocket';
import { useGatewayStore } from '@/stores/gateway';

interface LogEntry {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
}

function getLevelIcon(level: LogEntry['level']) {
  switch (level) {
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
    case 'info':
      return <Info className="w-3 h-3 text-blue-500" />;
    case 'debug':
      return <Bug className="w-3 h-3 text-gray-500" />;
  }
}

function getLevelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error': return 'text-red-400';
    case 'warn': return 'text-yellow-400';
    case 'info': return 'text-blue-400';
    case 'debug': return 'text-gray-400';
  }
}

export function LogViewer() {
  const { connected } = useGatewayStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  // Subscribe to gateway messages
  useEffect(() => {
    if (!connected) return;

    try {
      const gateway = getGateway();
      
      const unsubscribe = gateway.onMessage((message) => {
        if (typeof message !== 'object' || message === null) return;
        
        const msg = message as Record<string, unknown>;
        
        // Parse different message types into logs
        let entry: LogEntry | null = null;
        
        if (msg.type === 'error' || msg.error) {
          const error = typeof msg.error === 'object' && msg.error !== null
            ? (msg.error as Record<string, unknown>).message as string
            : String(msg.error || msg.message || 'Unknown error');
          entry = {
            id: `log-${++logIdRef.current}`,
            level: 'error',
            message: error,
            timestamp: new Date(),
            source: msg.source as string
          };
        } else if (msg.type === 'event' && msg.event) {
          entry = {
            id: `log-${++logIdRef.current}`,
            level: 'info',
            message: `Event: ${msg.event}`,
            timestamp: new Date(),
            source: 'gateway'
          };
        } else if (msg.type === 'res' && !msg.ok) {
          const error = msg.error as { message?: string } | undefined;
          entry = {
            id: `log-${++logIdRef.current}`,
            level: 'warn',
            message: error?.message || 'Request failed',
            timestamp: new Date()
          };
        }
        
        if (entry) {
          setLogs(prev => [...prev.slice(-99), entry!]);
        }
      });

      return () => unsubscribe();
    } catch {
      // Gateway not initialized yet
    }
  }, [connected]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const exportLogs = useCallback(() => {
    const content = logs.map(log => 
      `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="w-5 h-5" />
            实时日志
          </CardTitle>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {errorCount} 错误
              </Badge>
            )}
            {warnCount > 0 && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">
                {warnCount} 警告
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={exportLogs}
              disabled={logs.length === 0}
              className="h-7 w-7 p-0"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={scrollRef}
          className="font-mono text-xs bg-black/90 rounded-lg p-3 h-[200px] overflow-y-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
            setAutoScroll(isAtBottom);
          }}
        >
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-0.5 hover:bg-white/5">
                <span className="text-gray-500 shrink-0">
                  {formatTime(log.timestamp)}
                </span>
                {getLevelIcon(log.level)}
                <span className={getLevelColor(log.level)}>
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-center py-8">
              {connected ? '等待日志...' : '未连接'}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{logs.length} 条日志</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            自动滚动
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
