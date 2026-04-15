// app/lib/ws/client.ts
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerMessage, AnnotationPayload } from './types';

interface UseStudyWebSocketOptions {
  studyId: number;
  onAnnotationCreated?: (annotation: AnnotationPayload) => void;
  onAnnotationDeleted?: (annotationId: number) => void;
  onPresenceUpdate?: (activeReaders: number) => void;
}

export function useStudyWebSocket({
  studyId,
  onAnnotationCreated,
  onAnnotationDeleted,
  onPresenceUpdate,
}: UseStudyWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents reconnect loop after component unmount
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', studyId }));
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data as string);
        switch (message.type) {
          case 'annotation:created':
            onAnnotationCreated?.(message.annotation);
            break;
          case 'annotation:deleted':
            onAnnotationDeleted?.(message.annotationId);
            break;
          case 'presence:update':
            onPresenceUpdate?.(message.activeReaders);
            break;
          // pong and error: no-op on client
        }
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (mountedRef.current) {
        // Reconnect after 3 seconds only if still mounted
        reconnectTimeoutRef.current = setTimeout(connect, 3_000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [studyId, onAnnotationCreated, onAnnotationDeleted, onPresenceUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave', studyId }));
        ws.close();
      }
    };
  }, [connect, studyId]);

  return { connected };
}
