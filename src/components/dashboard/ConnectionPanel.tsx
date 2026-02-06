'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const DEFAULT_URL = 'ws://127.0.0.1:18789';

// Get initial values outside component to avoid effect setState issues
function getInitialCredentials() {
  if (typeof window === 'undefined') return { url: DEFAULT_URL, token: '' };
  
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlGateway = params.get('gatewayUrl') || params.get('url');
  
  const token = urlToken || localStorage.getItem('openclaw-gateway-token') || '';
  const url = urlGateway || localStorage.getItem('openclaw-gateway-url') || DEFAULT_URL;
  
  return { url, token };
}

export function ConnectionPanel() {
  const { connected, connecting, error, connect, disconnect } = useGatewayStore();
  const initial = getInitialCredentials();
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState(initial.token);
  const initRef = useRef(false);

  // Handle auto-connect on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    const creds = getInitialCredentials();
    
    // Clean URL for security
    const params = new URLSearchParams(window.location.search);
    if (params.get('token')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Auto-connect if we have credentials
    if (creds.url && creds.token) {
      localStorage.setItem('openclaw-gateway-url', creds.url);
      localStorage.setItem('openclaw-gateway-token', creds.token);
      connect(creds.url, creds.token);
    }
  }, [connect]);

  const handleConnect = async () => {
    // Save to localStorage
    localStorage.setItem('openclaw-gateway-url', url);
    localStorage.setItem('openclaw-gateway-token', token);
    
    await connect(url, token);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('openclaw-gateway-token');
    disconnect();
  };

  if (connected) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-green-500" />
          <Badge variant="default" className="bg-green-500">已连接</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleDisconnect}>
          断开
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <WifiOff className="w-5 h-5 text-muted-foreground" />
          连接到 Gateway
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="WebSocket URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleConnect} 
              disabled={connecting || !url || !token}
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  连接中...
                </>
              ) : (
                '连接'
              )}
            </Button>
          </div>
          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}
          <div className="text-xs text-muted-foreground">
            运行 <code className="bg-muted px-1 rounded">openclaw dashboard</code> 获取 Token
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
