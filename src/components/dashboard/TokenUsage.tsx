'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGatewayStore } from '@/stores/gateway';
import { Coins } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export function TokenUsage() {
  const { sessions } = useGatewayStore();

  // Group sessions by model and calculate token usage
  const modelUsage = sessions.reduce((acc, session) => {
    const model = session.model.split('/').pop() || session.model;
    const shortModel = model.length > 15 ? model.slice(0, 12) + '...' : model;
    
    if (!acc[shortModel]) {
      acc[shortModel] = { model: shortModel, tokens: 0, sessions: 0 };
    }
    acc[shortModel].tokens += session.tokens.used;
    acc[shortModel].sessions += 1;
    return acc;
  }, {} as Record<string, { model: string; tokens: number; sessions: number }>);

  const data = Object.values(modelUsage)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 6);

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  const formatTokens = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="w-5 h-5" />
          Token 使用量（按模型）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#666" 
                  fontSize={12}
                  tickFormatter={formatTokens}
                />
                <YAxis 
                  type="category" 
                  dataKey="model" 
                  stroke="#666" 
                  fontSize={11}
                  width={100}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [formatTokens(value as number), 'Tokens']}
                  labelStyle={{ color: '#999' }}
                />
                <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            暂无 Token 使用数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
