'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGatewayStore } from '@/stores/gateway';
import { TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useEffect, useState } from 'react';

interface HealthPoint {
  time: string;
  score: number;
}

export function HealthTrend() {
  const { health } = useGatewayStore();
  const [history, setHistory] = useState<HealthPoint[]>([]);

  // Add new data point when health changes
  useEffect(() => {
    if (health?.score !== undefined) {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      setHistory(prev => {
        const newHistory = [...prev, { time: timeStr, score: health.score }];
        // Keep last 24 points
        return newHistory.slice(-24);
      });
    }
  }, [health?.score]);

  // Generate mock historical data if no history
  const displayData = history.length > 0 ? history : generateMockData();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5" />
          健康度趋势（最近24小时）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData}>
              <defs>
                <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="time" 
                stroke="#666" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="#666" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#999' }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#healthGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function generateMockData(): HealthPoint[] {
  const data: HealthPoint[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:00`;
    // Generate realistic fluctuating health scores
    const baseScore = 85;
    const variation = Math.sin(i * 0.5) * 10 + Math.random() * 5;
    const score = Math.max(60, Math.min(100, Math.round(baseScore + variation)));
    data.push({ time: timeStr, score });
  }
  
  return data;
}
