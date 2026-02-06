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
} from '@/components/dashboard';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { connected, refresh } = useGatewayStore();

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
          <div className="flex items-center gap-2">
            {connected && (
              <>
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
            <div className="grid gap-6 md:grid-cols-2">
              <HealthTrend />
              <TokenUsage />
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

              {/* Right - Activity */}
              <div className="lg:col-span-3">
                <ActivityLog />
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
