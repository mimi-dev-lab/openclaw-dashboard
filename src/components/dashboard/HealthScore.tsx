'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGatewayStore } from '@/stores/gateway';
import { Activity, AlertTriangle, AlertCircle, Info } from 'lucide-react';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  return 'text-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '健康';
  if (score >= 60) return '警告';
  return '危险';
}

function getIssueIcon(level: string) {
  switch (level) {
    case 'critical':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
}

export function HealthScore() {
  const { health } = useGatewayStore();

  const score = health?.score ?? 100;
  const issues = health?.issues ?? [];
  const criticalCount = issues.filter(i => i.level === 'critical').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5" />
          健康度
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Score Display */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <div className={`text-6xl font-bold ${getScoreColor(score)}`}>
              {score}
            </div>
            <Badge 
              variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive'}
              className="absolute -top-1 -right-8"
            >
              {getScoreLabel(score)}
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress 
          value={score} 
          className="h-2 mb-4"
        />

        {/* Issue Summary */}
        <div className="flex gap-4 mb-4 text-sm justify-center">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertCircle className="w-4 h-4" />
              <span>{criticalCount} 严重</span>
            </div>
          )}
          {warnCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-4 h-4" />
              <span>{warnCount} 警告</span>
            </div>
          )}
          {criticalCount === 0 && warnCount === 0 && (
            <div className="text-green-500">✓ 一切正常</div>
          )}
        </div>

        {/* Issue List */}
        {issues.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {issues.slice(0, 5).map((issue, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm"
              >
                {getIssueIcon(issue.level)}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{issue.message}</div>
                  {issue.fix && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      修复: {issue.fix}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {issues.length > 5 && (
              <div className="text-center text-xs text-muted-foreground">
                还有 {issues.length - 5} 个问题...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
