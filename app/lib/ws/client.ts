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

  // Store callbacks in refs so the connect function doesn't depend on them.
  // Without this, passing inline arrow functions from the parent causes
  // connect to get a new identity every render, bouncing the WebSocket.
  const onAnnotationCreatedRef = useRef(onAnnotationCreated);
  const onAnnotationDeletedRef = useRef(onAnnotationDeleted);
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  useEffect(() => { onAnnotationCreatedRef.current = onAnnotationCreated; }, [onAnnotationCreated]);
  useEffect(() => { onAnnotationDeletedRef.current = onAnnotationDeleted; }, [onAnnotationDeleted]);
  useEffect(() => { onPresenceUpdateRef.current = onPresenceUpdate; }, [onPresenceUpdate]);

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
            onAnnotationCreatedRef.current?.(message.annotation);
            break;
          case 'annotation:deleted':
            onAnnotationDeletedRef.current?.(message.annotationId);
            break;
          case 'presence:update':
            onPresenceUpdateRef.current?.(message.activeReaders);
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
  }, [studyId]);

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
