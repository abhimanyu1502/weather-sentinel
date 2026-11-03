/**
 * useLiveWeatherSocket.ts — Real-time WebSocket connection hook for StormSentinel.
 *
 * Promoted from legacy to serve as the unified bridge between the FastAPI nowcasting
 * engine and the React UI. Supports automatic reconnection, region subscription,
 * heartbeats, and payload normalization.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { BackendStatePayload, normalizeBackendPayload } from "./backendAdapter";
import { WeatherSnapshot } from "./weatherEngine";

interface UseLiveWeatherSocketOptions {
  enabled?: boolean;
  regionId?: string | null;
  baseWsUrl?: string;
  onPayload?: (payload: BackendStatePayload) => void;
}

export const DEFAULT_WS_URL = (import.meta.env.VITE_WS_BASE_URL as string | undefined) || "ws://localhost:8000";

export function useLiveWeatherSocket(options: UseLiveWeatherSocketOptions = {}) {
  const {
    enabled = true,
    regionId = null,
    baseWsUrl = DEFAULT_WS_URL,
    onPayload,
  } = options;

  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  const [rawPayload, setRawPayload] = useState<BackendStatePayload | null>(null);
  const [normalizedSnapshot, setNormalizedSnapshot] = useState<WeatherSnapshot | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(1500);
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  const wsUrl = regionId && regionId !== "ALL_INDIA"
    ? `${baseWsUrl}/ws/regions/${regionId}`
    : `${baseWsUrl}/ws/live-stream`;

  const connect = useCallback(() => {
    if (!enabled) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      setConnecting(true);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setConnectionError(null);
        backoffRef.current = 1500;
        console.info(`[StormSentinel WS] Connected to live nowcast stream: ${wsUrl}`);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === "pong") return;
          const data = JSON.parse(event.data);
          if (data && data.timestamp) {
            setRawPayload(data);
            setLastMessageTime(Date.now());
            const normalized = normalizeBackendPayload(data);
            setNormalizedSnapshot(normalized);
            if (onPayloadRef.current) {
              onPayloadRef.current(data);
            }
          }
        } catch (err) {
          console.warn("[StormSentinel WS] Error parsing packet:", err);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        setConnecting(false);
        if (!event.wasClean) {
          setConnectionError("Backend connection closed unexpectedly");
        }
        // Auto-reconnect with exponential backoff up to 8s
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        const delay = backoffRef.current;
        backoffRef.current = Math.min(8000, backoffRef.current * 1.5);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        setConnected(false);
        setConnecting(false);
        setConnectionError("Backend WebSocket unavailable (falling back to deterministic simulation)");
      };
    } catch (e: any) {
      setConnected(false);
      setConnecting(false);
      setConnectionError(e?.message || "Failed to establish WebSocket connection");
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [enabled, wsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
  }, []);

  const manualReconnect = useCallback(() => {
    disconnect();
    backoffRef.current = 1000;
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    connect();

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send("ping");
        } catch {
          // Ignore ping send failures
        }
      }
    }, 12000);

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    connecting,
    lastMessageTime,
    rawPayload,
    normalizedSnapshot,
    connectionError,
    reconnect: manualReconnect,
  };
}
