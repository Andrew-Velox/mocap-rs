import { useCallback, useEffect, useRef, useState } from "react";

export type WsStatus = "connecting" | "open" | "closed";

interface UseWebSocketOptions {
  /** Called for every inbound message (already parsed if JSON). */
  onMessage?: (data: unknown) => void;
  /** Auto-reconnect with backoff (default true). */
  reconnect?: boolean;
}

/**
 * Reusable WebSocket connection used by both ends of the app:
 *   * the phone — as a *publisher* (calls `send` with landmark frames)
 *   * the desktop — as a *subscriber* (consumes via `onMessage`)
 *
 * Handles reconnection with capped backoff and exposes a live status.
 */
export function useWebSocket(url: string | null, opts: UseWebSocketOptions = {}) {
  const { onMessage, reconnect = true } = opts;
  const [status, setStatus] = useState<WsStatus>("closed");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const retryRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const closedByUs = useRef(false);

  useEffect(() => {
    if (!url) return;
    closedByUs.current = false;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
      };
      ws.onmessage = (ev) => {
        let data: unknown = ev.data;
        if (typeof ev.data === "string") {
          try {
            data = JSON.parse(ev.data);
          } catch {
            /* leave as raw string */
          }
        }
        onMessageRef.current?.(data);
      };
      ws.onclose = () => {
        setStatus("closed");
        if (reconnect && !closedByUs.current) {
          const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
          retryRef.current += 1;
          timerRef.current = window.setTimeout(connect, delay);
        }
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closedByUs.current = true;
      window.clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [url, reconnect]);

  /** Send a value (objects are JSON-encoded). No-op if socket isn't open. */
  const send = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(typeof data === "string" ? data : JSON.stringify(data));
    return true;
  }, []);

  return { status, send };
}
