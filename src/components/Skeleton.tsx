'use client';

import { cn } from '@/lib/utils';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('animate-pulse bg-[hsl(var(--secondary))] rounded', className)} style={style} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 rounded-2xl p-6 border border-purple-600/20">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-8 w-12 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-[hsl(var(--border))]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full max-w-[100px]" />
        </td>
      ))}
    </tr>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 bg-[hsl(var(--secondary))] rounded-xl">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div>
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-48 flex items-end justify-around gap-2 px-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="w-8 rounded-t"
          style={{ height: `${30 + Math.random() * 70}%` }}
        />
      ))}
    </div>
  );
}

export function FlowNodeSkeleton() {
  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <div className="flex gap-1">
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
    </div>
  );
}
