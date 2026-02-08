'use client';

/**
 * Gateway Client - WebSocket RPC
 */

export interface GatewayConfig {
  url: string;
  token: string;
}

export interface ConnectSnapshot {
  uptimeMs?: number;
  health?: {
    ok: boolean;
    channels: Record<string, {
      configured: boolean;
      probe?: { ok: boolean; bot?: { username?: string } };
    }>;
    channelLabels?: Record<string, string>;
    agents?: Array<{
      agentId: string;
      name?: string;
      isDefault?: boolean;
      sessions?: { count: number };
    }>;
  };
  sessionDefaults?: {
    defaultAgentId?: string;
  };
}

/**
 * Make a single RPC call to Gateway
 */
export async function gatewayCall<T = unknown>(
  config: GatewayConfig,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 15000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error(`超时: ${method}`));
    }, timeoutMs);

    let ws: WebSocket | null = null;
    let authenticated = false;
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      ws = new WebSocket(config.url);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'event' && data.event === 'connect.challenge') {
            const connectRequest = {
              type: 'req',
              id: `connect-${Date.now()}`,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'openclaw-control-ui',
                  version: '0.1.0',
                  platform: 'web',
                  mode: 'ui'
                },
                role: 'operator',
                scopes: ['operator.admin'],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: config.token },
                locale: 'zh-CN',
                userAgent: 'openclaw-dashboard/0.2.0'
              }
            };
            ws?.send(JSON.stringify(connectRequest));
            return;
          }

          if (data.type === 'res' && data.id?.startsWith('connect-')) {
            if (data.ok) {
              authenticated = true;
              const request = { type: 'req', id: requestId, method, params };
              ws?.send(JSON.stringify(request));
            } else {
              clearTimeout(timeout);
              ws?.close();
              reject(new Error(data.error?.message || '认证失败'));
            }
            return;
          }

          if (data.type === 'res' && data.id === requestId) {
            clearTimeout(timeout);
            ws?.close();
            if (data.ok) {
              resolve(data.payload as T);
            } else {
              reject(new Error(data.error?.message || '请求失败'));
            }
            return;
          }
        } catch (err) {
          console.error('[Gateway] Parse error:', err);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket 连接失败'));
      };

      ws.onclose = () => {
        if (!authenticated) {
          clearTimeout(timeout);
          reject(new Error('连接关闭'));
        }
      };
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * Connect and get snapshot + batch calls
 */
export async function gatewayBatchWithSnapshot<T extends Record<string, unknown>>(
  config: GatewayConfig,
  calls: { method: string; params?: Record<string, unknown> }[],
  timeoutMs = 30000
): Promise<{ snapshot: ConnectSnapshot; results: T }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error('请求超时'));
    }, timeoutMs);

    let ws: WebSocket | null = null;
    let snapshot: ConnectSnapshot = {};
    const results: Record<string, unknown> = {};
    const pendingIds = new Map<string, string>();

    try {
      ws = new WebSocket(config.url);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'event' && data.event === 'connect.challenge') {
            const connectRequest = {
              type: 'req',
              id: `connect-${Date.now()}`,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'openclaw-control-ui',
                  version: '0.1.0',
                  platform: 'web',
                  mode: 'ui'
                },
                role: 'operator',
                scopes: ['operator.admin'],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: config.token },
                locale: 'zh-CN',
                userAgent: 'openclaw-dashboard/0.2.0'
              }
            };
            ws?.send(JSON.stringify(connectRequest));
            return;
          }

          if (data.type === 'res' && data.id?.startsWith('connect-')) {
            if (data.ok) {
              // Extract snapshot from connect response
              snapshot = data.payload?.snapshot || {};
              
              // Send all batch requests
              calls.forEach((call, index) => {
                const id = `req-${Date.now()}-${index}`;
                pendingIds.set(id, call.method);
                ws?.send(JSON.stringify({
                  type: 'req',
                  id,
                  method: call.method,
                  params: call.params || {}
                }));
              });
            } else {
              clearTimeout(timeout);
              ws?.close();
              reject(new Error(data.error?.message || '认证失败'));
            }
            return;
          }

          if (data.type === 'res' && pendingIds.has(data.id)) {
            const method = pendingIds.get(data.id)!;
            pendingIds.delete(data.id);
            
            if (data.ok) {
              results[method] = data.payload;
            } else {
              results[method] = { error: data.error?.message || '失败' };
            }

            if (pendingIds.size === 0) {
              clearTimeout(timeout);
              ws?.close();
              resolve({ snapshot, results: results as T });
            }
          }
        } catch (err) {
          console.error('[Gateway] Parse error:', err);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket 连接失败'));
      };

      ws.onclose = () => {
        // If we have results, resolve anyway
        if (Object.keys(results).length > 0) {
          clearTimeout(timeout);
          resolve({ snapshot, results: results as T });
        }
      };
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

// Legacy function for compatibility
export async function gatewayBatch<T extends Record<string, unknown>>(
  config: GatewayConfig,
  calls: { method: string; params?: Record<string, unknown> }[],
  timeoutMs = 30000
): Promise<T> {
  const { results } = await gatewayBatchWithSnapshot<T>(config, calls, timeoutMs);
  return results;
}
