'use client';

import type { RPCResponse } from './types';

type MessageHandler = (message: unknown) => void;
type ConnectionHandler = (connected: boolean) => void;

export class GatewayWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private requestId = 0;
  private authenticated = false;
  private pendingNonce: string | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.authenticated = false;

        this.ws.onopen = () => {
          console.log('[WS] WebSocket opened, waiting for challenge...');
          // Don't notify connected yet - wait for authentication
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data, resolve, reject);
          } catch (err) {
            console.error('[WS] Failed to parse message:', err);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
          this.authenticated = false;
          this.notifyConnectionHandlers(false);
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(new Error('WebSocket connection failed'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private sendConnect(nonce?: string) {
    const connectRequest = {
      type: 'req',
      id: `connect-${Date.now()}`,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-dashboard',
          version: '0.1.0',
          platform: 'web',
          mode: 'operator'
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: this.token },
        locale: 'zh-CN',
        userAgent: 'openclaw-dashboard/0.1.0',
        ...(nonce ? { device: { nonce } } : {})
      }
    };
    console.log('[WS] Sending connect request...');
    this.ws?.send(JSON.stringify(connectRequest));
  }

  private handleMessage(data: unknown, onConnect?: () => void, onError?: (err: Error) => void) {
    if (typeof data !== 'object' || data === null) return;
    
    const msg = data as Record<string, unknown>;
    
    // Handle connect challenge
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      const payload = msg.payload as { nonce: string; ts: number } | undefined;
      console.log('[WS] Received challenge, nonce:', payload?.nonce?.slice(0, 8) + '...');
      this.pendingNonce = payload?.nonce || null;
      this.sendConnect(this.pendingNonce || undefined);
      return;
    }
    
    // Handle connect response
    if (msg.type === 'res' && typeof msg.id === 'string' && msg.id.startsWith('connect-')) {
      if (msg.ok) {
        console.log('[WS] Authentication successful!');
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionHandlers(true);
        onConnect?.();
      } else {
        const error = msg.error as { message?: string } | undefined;
        const errorMsg = error?.message || 'Authentication failed';
        console.error('[WS] Authentication failed:', errorMsg);
        onError?.(new Error(errorMsg));
      }
      return;
    }
    
    // Check if it's an RPC response
    if (msg.type === 'res' && typeof msg.id === 'string') {
      const response = data as RPCResponse;
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        if (!response.ok && response.error) {
          const err = response.error as { message?: string };
          pending.reject(new Error(err.message || 'Request failed'));
        } else {
          pending.resolve(response.payload);
        }
        return;
      }
    }

    // Notify all message handlers for other events
    this.messageHandlers.forEach(handler => handler(data));
  }

  private handleDisconnect() {
    // Reject all pending requests
    this.pendingRequests.forEach((pending, id) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection lost'));
      this.pendingRequests.delete(id);
    });

    // Auto-reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    const id = `req-${++this.requestId}`;
    const request = {
      type: 'req',
      id,
      method,
      params: params || {}
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      });

      this.ws?.send(JSON.stringify(request));
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyConnectionHandlers(connected: boolean) {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let instance: GatewayWebSocket | null = null;

export function getGateway(url?: string, token?: string): GatewayWebSocket {
  if (!instance && url && token) {
    instance = new GatewayWebSocket(url, token);
  }
  if (!instance) {
    throw new Error('Gateway not initialized. Call getGateway(url, token) first.');
  }
  return instance;
}

export function resetGateway() {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
