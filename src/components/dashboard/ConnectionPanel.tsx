'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const DEFAULT_URL = 'ws://127.0.0.1:18789';

export function ConnectionPanel() {
  const { connected, connecting, error, connect, disconnect } = useGatewayStore();
  const [url, setUrl] = useState(DEFAULT_URL);
  const [token, setToken] = useState('');

  // Load saved connection from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('openclaw-gateway-url');
    const savedToken = localStorage.getItem('openclaw-gateway-token');
    if (savedUrl) setUrl(savedUrl);
    if (savedToken) setToken(savedToken);
  }, []);

  const handleConnect = async () => {
    // Save to localStorage
    localStorage.setItem('openclaw-gateway-url', url);
    localStorage.setItem('openclaw-gateway-token', token);
    
    await connect(url, token);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Auto-connect from URL params or saved credentials
  useEffect(() => {
    // Check URL params first (for easy testing)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlGateway = params.get('gatewayUrl') || params.get('url');
    
    let connectUrl = url;
    let connectToken = token;
    
    if (urlToken) {
      connectToken = urlToken;
      setToken(urlToken);
      // Remove token from URL for security
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (urlGateway) {
      connectUrl = urlGateway;
      setUrl(urlGateway);
    }
    
    // Fall back to localStorage
    if (!connectToken) {
      const savedToken = localStorage.getItem('openclaw-gateway-token');
      if (savedToken) {
        connectToken = savedToken;
        setToken(savedToken);
      }
    }
    if (!connectUrl || connectUrl === DEFAULT_URL) {
      const savedUrl = localStorage.getItem('openclaw-gateway-url');
      if (savedUrl) {
        connectUrl = savedUrl;
        setUrl(savedUrl);
      }
    }
    
    // Auto-connect if we have credentials
    if (connectUrl && connectToken && !connected && !connecting) {
      // Small delay to ensure state is set
      setTimeout(() => {
        connect(connectUrl, connectToken);
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

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
