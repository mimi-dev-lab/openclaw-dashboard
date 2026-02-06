'use client';

import { useGatewayStore } from '@/stores/gateway';
import {
  SystemOverview,
  AgentOrgChart,
  ChannelStatus,
  HealthScore,
  HealthTrend,
  TokenUsage,
  ActivityLog,
  QuickActions,
  SessionList,
  ConnectionPanel,
  CronJobs,
  ModelQuota,
  LogViewer,
} from '@/components/dashboard';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { connected, refresh, sessions, agents, health } = useGatewayStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <div>
              <h1 className="text-lg font-bold leading-none">OpenClaw 作战指挥中心</h1>
              <p className="text-xs text-muted-foreground">系统状态监控面板</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <>
                {/* Quick Stats */}
                <div className="hidden md:flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="gap-1">
                    🤖 {agents.length} Agents
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    💬 {sessions.length} Sessions
                  </Badge>
                  {health && (
                    <Badge 
                      variant={health.score >= 80 ? 'default' : health.score >= 60 ? 'secondary' : 'destructive'}
                      className="gap-1"
                    >
                      ❤️ {health.score}
                    </Badge>
                  )}
                </div>
                <div className="h-4 w-px bg-border" />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => refresh()}
                  className="gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新
                </Button>
                <ConnectionPanel />
              </>
            )}
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-1.5">
              {connected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs ${connected ? 'text-green-500' : 'text-red-500'}`}>
                {connected ? '已连接' : '离线'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {!connected ? (
          <div className="max-w-md mx-auto">
            <ConnectionPanel />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Row - Overview Stats */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <SystemOverview />
              </div>
              <div className="lg:col-span-1">
                <HealthScore />
              </div>
              <div className="lg:col-span-1">
                <QuickActions />
              </div>
            </div>

            {/* Middle Row - Charts */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <HealthTrend />
              <TokenUsage />
              <ModelQuota />
            </div>

            {/* Bottom Row - Details */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left - Agents & Channels */}
              <div className="lg:col-span-4 space-y-6">
                <AgentOrgChart />
                <ChannelStatus />
              </div>

              {/* Middle - Sessions & Cron */}
              <div className="lg:col-span-5 space-y-6">
                <SessionList />
                <CronJobs />
              </div>

              {/* Right - Activity & Logs */}
              <div className="lg:col-span-3 space-y-6">
                <ActivityLog />
                <LogViewer />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <span>OpenClaw Dashboard v0.1.0</span>
          <span>Built with 🐱 by Mimi</span>
        </div>
      </footer>
    </div>
  );
}
