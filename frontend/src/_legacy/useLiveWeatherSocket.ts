import { useState, useEffect, useRef, useCallback } from "react";
import { HazardState } from "../types/weather";

export function useLiveWeatherSocket(url: string = "ws://localhost:8000/ws/live-stream") {
  const [hazardState, setHazardState] = useState<HazardState | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastMessageTime, setLastMessageTime] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log("Connected to StormSentinel Live Stream");
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === "pong") return;
          const data = JSON.parse(event.data);
          if (data && data.simulation_timestep !== undefined) {
            setHazardState(data);
            setLastMessageTime(Date.now());
          }
        } catch (err) {
          console.error("Error parsing WebSocket packet:", err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn("WebSocket error:", err);
        ws.close();
      };
    } catch (e) {
      console.error("Failed to establish WebSocket connection:", e);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [url]);

  useEffect(() => {
    connect();

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { hazardState, connected, lastMessageTime };
}
