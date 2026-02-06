'use client';

import type { RPCRequest, RPCResponse, ConnectParams } from './types';

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

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] Connected, sending auth...');
          // Send connect message with auth
          const connectMsg: { connect: { params: ConnectParams } } = {
            connect: {
              params: {
                auth: { token: this.token }
              }
            }
          };
          this.ws?.send(JSON.stringify(connectMsg));
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('[WS] Failed to parse message:', err);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
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

  private handleMessage(data: unknown) {
    // Check if it's an RPC response
    if (typeof data === 'object' && data !== null && 'id' in data) {
      const response = data as RPCResponse;
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
        return;
      }
    }

    // Notify all message handlers
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

    const id = `req-${++this.requestId}`;
    const request: RPCRequest = { id, method, params };

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
