# Brief 08: Real-Time Annotations & Community Highlights ✅ COMPLETE

**08a completed:** 2026-04-14 (Sonnet, Plan Mode → Direct Execution)
**08b completed:** 2026-04-14 (Opus, Direct Execution)

> **📌 V2 Deferral (2026-04-15):** The **public/community annotation layer built in this brief is deferred to V2 (Study Rooms).** V1 ships with private-only annotations. The community toggle UI, community annotation count badge, "show community annotations" toggle, and public visibility controls must be **hidden or removed** before V1 launch. The underlying schema (`is_public` column) and WebSocket broadcast infrastructure stay in place for V2 reuse — rooms will replace the global public layer with scoped room-based sharing. See `founders-files/implementation-plan.md → Post-V1 Roadmap` for the full design rationale. **Pre-launch cleanup is tracked in the Brief 14 launch checklist.**

**Recommended mode: Plan Mode**

> **Branch:** All work on `develop`. Commit when complete with message: `Brief 08: Annotations — custom server, WebSocket rooms, text selection, real-time sync`
> **Path note:** This project uses `app/` not `app/src/`.

---

## ⚠️ Pre-Implementation Notes (April 14, 2026)

**This brief is split into two execution phases** per the implementation plan:
- **08a (Sonnet, Plan Mode):** Sections 1-4, 10-11 — custom server, WebSocket infrastructure, annotation CRUD, broadcaster pattern. Pure backend/architecture.
- **08b (Opus, Direct Execution):** Sections 5-9, 12 — text selection, highlight layer, popovers, community toggle, reader integration. Use `frontend-design` skill. 08a must complete first.

**Three issues to resolve during 08a planning:**

1. **Schema mismatch:** The existing `annotations` table in `schema.ts` has columns `(id, study_id, user_id, type, content, start_offset, end_offset, color, is_public, created_at)`. This brief expects `selected_text`, `note_text`, and `updated_at` columns instead of `content`. A migration must reconcile this — either add the missing columns or clarify usage of the existing `content` field.

2. **Next.js 16 custom server compatibility:** This brief uses `next({ dev, hostname, port })` constructor to create a custom HTTP server wrapping Next.js. AGENTS.md warns about breaking API changes in Next.js 16. The 08a planner **must verify** this pattern works by checking `node_modules/next/dist/docs/` before implementing. If the constructor API changed, the server.ts pattern needs updating.

3. **WebSocket authentication:** The brief shows `userId` from query params with a "validated server-side" comment but no actual validation code. The app uses iron-session — the 08a planner must design proper WebSocket auth that validates the session cookie during the WS upgrade handshake (not just trusting a userId param).

---

## Overview

Implement the real-time annotation system that lets users highlight text and add notes within Bible studies, then share those annotations with the community in real time via WebSockets. This is the collaborative layer on top of the immersive study reader (built in Brief 07).

---

## Critical Context

- **Project root**: `/Users/davidgeorge/Desktop/study-app/app/`
- **Stack**: Next.js 16 (App Router, TypeScript, React 19), Tailwind CSS 4, Shadcn/ui, better-sqlite3, iron-session, Framer Motion
- **Hosting**: Railway ($5/mo persistent server) — Railway supports WebSockets natively
- **Database**: SQLite `app.db`
- **Design reference**: `/Users/davidgeorge/Desktop/study-app/founders-files/DESIGN-DECISIONS.md`

### Key Design Decisions

- Annotations are per-study, real-time via WebSockets
- Community highlights/notes visible to others (toggleable via a switch in the reader)
- Users can choose whether their annotations are public or private
- Railway supports WebSockets natively — no separate infrastructure needed
- Use the `ws` npm package (lightweight, no Socket.io overhead)

---

## Database Schema

Add these tables to `app.db` (if not already created):

```sql
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('highlight', 'note')),
  color TEXT DEFAULT 'yellow' CHECK(color IN ('yellow', 'green', 'blue', 'pink', 'purple')),
  start_offset INTEGER NOT NULL, -- character offset in markdown content
  end_offset INTEGER NOT NULL,   -- character offset in markdown content
  selected_text TEXT NOT NULL,    -- the highlighted text (for display even if offsets shift)
  note_text TEXT,                 -- only for type='note'
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_annotations_study ON annotations(study_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_public ON annotations(study_id, is_public);
```

---

## File Structure

```
src/
  components/
    reader/
      highlight-layer.tsx       -- Text selection + highlight rendering
      annotation-popover.tsx    -- Popover for creating annotations
      annotation-notes.tsx      -- Margin notes display
      community-toggle.tsx      -- Toggle community annotations (update from Brief 07)
      annotation-colors.ts      -- Color constants and utilities
  lib/
    ws/
      server.ts                 -- WebSocket server setup
      client.ts                 -- React hook for WebSocket client
      types.ts                  -- Shared WebSocket message types
    hooks/
      use-text-selection.ts     -- Hook for detecting text selection
      use-study-annotations.ts  -- Hook combining REST + WebSocket state
  app/
    api/
      studies/
        [id]/
          annotations/
            route.ts            -- GET, POST annotations
            [annotationId]/
              route.ts          -- DELETE annotation
  server.ts                     -- Custom Next.js server (for WebSocket support)
```

---

## 1. WebSocket Message Types

**File**: `/src/lib/ws/types.ts`

```typescript
// Client -> Server messages
export type ClientMessage =
  | { type: 'join'; studyId: number; userId: number }
  | { type: 'leave'; studyId: number }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'annotation:created'; annotation: AnnotationPayload }
  | { type: 'annotation:deleted'; annotationId: number; studyId: number }
  | { type: 'presence:update'; studyId: number; activeReaders: number }
  | { type: 'pong' }
  | { type: 'error'; message: string };

export interface AnnotationPayload {
  id: number;
  study_id: number;
  user_id: number;
  username: string; // display name for the annotation author
  type: 'highlight' | 'note';
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note_text: string | null;
  is_public: boolean;
  created_at: string;
}
```

---

## 2. WebSocket Server

**File**: `/src/lib/ws/server.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { ClientMessage, ServerMessage, AnnotationPayload } from './types';

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  studyId: number | null;
}

const clients = new Map<WebSocket, ConnectedClient>();
const studyRooms = new Map<number, Set<WebSocket>>(); // studyId -> Set of WebSocket connections

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Parse userId from query string or cookie
    // For simplicity, expect ?userId=<id> (validated server-side)
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = parseInt(url.searchParams.get('userId') || '0', 10);

    if (!userId) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const client: ConnectedClient = { ws, userId, studyId: null };
    clients.set(ws, client);

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        handleMessage(ws, client, message);
      } catch (e) {
        sendToClient(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      if (client.studyId !== null) {
        leaveRoom(ws, client.studyId);
      }
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  // Heartbeat: ping all clients every 30s, close unresponsive ones
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

function handleMessage(ws: WebSocket, client: ConnectedClient, message: ClientMessage) {
  switch (message.type) {
    case 'join':
      if (client.studyId !== null) {
        leaveRoom(ws, client.studyId);
      }
      client.studyId = message.studyId;
      joinRoom(ws, message.studyId);
      break;

    case 'leave':
      if (client.studyId !== null) {
        leaveRoom(ws, client.studyId);
        client.studyId = null;
      }
      break;

    case 'ping':
      sendToClient(ws, { type: 'pong' });
      break;
  }
}

function joinRoom(ws: WebSocket, studyId: number) {
  if (!studyRooms.has(studyId)) {
    studyRooms.set(studyId, new Set());
  }
  studyRooms.get(studyId)!.add(ws);

  // Broadcast updated presence count
  broadcastToRoom(studyId, {
    type: 'presence:update',
    studyId,
    activeReaders: studyRooms.get(studyId)!.size,
  });
}

function leaveRoom(ws: WebSocket, studyId: number) {
  const room = studyRooms.get(studyId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      studyRooms.delete(studyId);
    } else {
      broadcastToRoom(studyId, {
        type: 'presence:update',
        studyId,
        activeReaders: room.size,
      });
    }
  }
}

// Called by API routes after creating/deleting annotations
export function broadcastAnnotationCreated(studyId: number, annotation: AnnotationPayload) {
  broadcastToRoom(studyId, { type: 'annotation:created', annotation });
}

export function broadcastAnnotationDeleted(studyId: number, annotationId: number) {
  broadcastToRoom(studyId, { type: 'annotation:deleted', annotationId, studyId });
}

function broadcastToRoom(studyId: number, message: ServerMessage) {
  const room = studyRooms.get(studyId);
  if (!room) return;
  const data = JSON.stringify(message);
  room.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function sendToClient(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

---

## 3. Custom Next.js Server

**File**: `/src/server.ts` (or `/server.ts` at project root)

Railway runs a persistent Node.js process, so we can use a custom server that handles both HTTP (Next.js) and WebSocket connections.

```typescript
import { createServer } from 'http';
import next from 'next';
import { setupWebSocketServer } from './lib/ws/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  setupWebSocketServer(server);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```

### Package.json Scripts

Update `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "next build",
    "start": "tsx src/server.ts"
  }
}
```

Install `tsx` for TypeScript execution:
```bash
npm install tsx
```

**Railway configuration**: Set the start command to `npm start`. Railway will run the custom server which handles both HTTP and WebSocket traffic on the same port.

---

## 4. WebSocket Client Hook

**File**: `/src/lib/ws/client.ts`

```typescript
"use client";
import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerMessage, AnnotationPayload } from './types';

interface UseWebSocketOptions {
  studyId: number;
  userId: number;
  onAnnotationCreated?: (annotation: AnnotationPayload) => void;
  onAnnotationDeleted?: (annotationId: number) => void;
  onPresenceUpdate?: (activeReaders: number) => void;
}

export function useStudyWebSocket({
  studyId,
  userId,
  onAnnotationCreated,
  onAnnotationDeleted,
  onPresenceUpdate,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${userId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', studyId, userId }));
    };

    ws.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
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
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [studyId, userId, onAnnotationCreated, onAnnotationDeleted, onPresenceUpdate]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'leave', studyId }));
        wsRef.current.close();
      }
    };
  }, [connect, studyId]);

  return { connected };
}
```

---

## 5. Annotations Hook (REST + WebSocket Combined)

**File**: `/src/lib/hooks/use-study-annotations.ts`

```typescript
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useStudyWebSocket } from '@/lib/ws/client';
import type { AnnotationPayload } from '@/lib/ws/types';

interface UseStudyAnnotationsOptions {
  studyId: number;
  userId: number;
  showCommunity: boolean;
}

export function useStudyAnnotations({ studyId, userId, showCommunity }: UseStudyAnnotationsOptions) {
  const [annotations, setAnnotations] = useState<AnnotationPayload[]>([]);
  const [activeReaders, setActiveReaders] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial annotations via REST
  useEffect(() => {
    async function fetchAnnotations() {
      setLoading(true);
      const res = await fetch(`/api/studies/${studyId}/annotations`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations);
      }
      setLoading(false);
    }
    fetchAnnotations();
  }, [studyId]);

  // Real-time updates via WebSocket
  const handleAnnotationCreated = useCallback((annotation: AnnotationPayload) => {
    setAnnotations((prev) => {
      // Avoid duplicates
      if (prev.some((a) => a.id === annotation.id)) return prev;
      return [...prev, annotation];
    });
  }, []);

  const handleAnnotationDeleted = useCallback((annotationId: number) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  }, []);

  const { connected } = useStudyWebSocket({
    studyId,
    userId,
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationDeleted: handleAnnotationDeleted,
    onPresenceUpdate: setActiveReaders,
  });

  // Filter based on showCommunity toggle
  const visibleAnnotations = annotations.filter((a) => {
    if (a.user_id === userId) return true; // always show own
    if (showCommunity && a.is_public) return true; // show public if toggled on
    return false;
  });

  // Create annotation (optimistic)
  const createAnnotation = useCallback(
    async (data: {
      type: 'highlight' | 'note';
      color: string;
      start_offset: number;
      end_offset: number;
      selected_text: string;
      note_text?: string;
      is_public: boolean;
    }) => {
      // Optimistic: add immediately with temp ID
      const tempAnnotation: AnnotationPayload = {
        id: -Date.now(), // temp negative ID
        study_id: studyId,
        user_id: userId,
        username: '', // will be filled by server
        ...data,
        color: data.color as AnnotationPayload['color'],
        note_text: data.note_text || null,
        created_at: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, tempAnnotation]);

      // Persist via API
      const res = await fetch(`/api/studies/${studyId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // Revert optimistic update
        setAnnotations((prev) => prev.filter((a) => a.id !== tempAnnotation.id));
        throw new Error('Failed to create annotation');
      }

      const created = await res.json();
      // Replace temp with real
      setAnnotations((prev) =>
        prev.map((a) => (a.id === tempAnnotation.id ? created.annotation : a))
      );

      return created.annotation;
    },
    [studyId, userId]
  );

  // Delete annotation
  const deleteAnnotation = useCallback(
    async (annotationId: number) => {
      const prev = annotations;
      setAnnotations((a) => a.filter((ann) => ann.id !== annotationId));

      const res = await fetch(`/api/studies/${studyId}/annotations/${annotationId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setAnnotations(prev); // revert
        throw new Error('Failed to delete annotation');
      }
    },
    [studyId, annotations]
  );

  return {
    annotations: visibleAnnotations,
    allAnnotations: annotations,
    loading,
    connected,
    activeReaders,
    createAnnotation,
    deleteAnnotation,
  };
}
```

---

## 6. Text Selection & Highlight Layer

**File**: `/src/components/reader/highlight-layer.tsx`

This is the most complex UI component. It handles:

1. Rendering existing highlights as colored backgrounds on the text
2. Detecting when the user selects text
3. Showing a popover to create a new annotation

### Text Selection Hook

**File**: `/src/lib/hooks/use-text-selection.ts`

```typescript
"use client";
import { useState, useEffect, useCallback } from 'react';

interface TextSelectionResult {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect; // position for popover
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelectionResult | null>(null);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // Don't immediately clear — let the popover handle dismissal
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      return;
    }

    const text = sel.toString().trim();
    if (!text) return;

    // Calculate character offsets relative to the container's text content
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + text.length;

    const rect = range.getBoundingClientRect();

    setSelection({ text, startOffset, endOffset, rect });
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('touchend', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('touchend', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, clearSelection };
}
```

### Highlight Rendering

To render highlights on the study content, use a two-layer approach:

1. **Content layer**: The normal markdown-rendered content (from Brief 07)
2. **Highlight layer**: Positioned absolutely over the content, using `<mark>` elements or CSS highlights

**Approach**: After the markdown is rendered, walk the DOM tree to find text nodes. For each annotation, find the text nodes that correspond to the annotation's `start_offset` and `end_offset`, and wrap them with a `<mark>` element.

```tsx
"use client";
import { useEffect, useRef } from 'react';
import type { AnnotationPayload } from '@/lib/ws/types';

interface HighlightLayerProps {
  contentRef: React.RefObject<HTMLElement | null>;
  annotations: AnnotationPayload[];
  userId: number;
  onAnnotationClick: (annotation: AnnotationPayload) => void;
}

const HIGHLIGHT_COLORS = {
  yellow: 'bg-yellow-200/40 dark:bg-yellow-500/20',
  green: 'bg-green-200/40 dark:bg-green-500/20',
  blue: 'bg-blue-200/40 dark:bg-blue-500/20',
  pink: 'bg-pink-200/40 dark:bg-pink-500/20',
  purple: 'bg-purple-200/40 dark:bg-purple-500/20',
} as const;

export function applyHighlights(
  container: HTMLElement,
  annotations: AnnotationPayload[],
  userId: number
) {
  // 1. Remove existing highlight marks
  container.querySelectorAll('mark[data-annotation-id]').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark);
    }
    parent?.removeChild(mark);
  });

  // 2. Sort annotations by start_offset (process from end to start to avoid offset shifting)
  const sorted = [...annotations].sort((a, b) => b.start_offset - a.start_offset);

  // 3. For each annotation, find the text range and wrap with <mark>
  sorted.forEach((annotation) => {
    try {
      const range = createRangeFromOffsets(container, annotation.start_offset, annotation.end_offset);
      if (!range) return;

      const mark = document.createElement('mark');
      mark.dataset.annotationId = String(annotation.id);
      mark.className = `cursor-pointer rounded-sm ${HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.yellow}`;

      // Different opacity for own vs. community annotations
      if (annotation.user_id !== userId) {
        mark.classList.add('opacity-60');
      }

      // If it has a note, add indicator
      if (annotation.type === 'note') {
        mark.classList.add('border-b', 'border-dashed', 'border-current');
      }

      range.surroundContents(mark);
    } catch (e) {
      // Graceful degradation: if DOM has changed and offsets don't match, skip
      console.warn('Could not apply highlight for annotation', annotation.id, e);
    }
  });
}

function createRangeFromOffsets(
  container: HTMLElement,
  startOffset: number,
  endOffset: number
): Range | null {
  // Walk text nodes to find the ones at the given offsets
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeLength = node.textContent?.length || 0;

    if (!startNode && currentOffset + nodeLength > startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && currentOffset + nodeLength >= endOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}
```

**Important**: Re-apply highlights whenever annotations change or the content re-renders. Use a `useEffect` that watches the annotations array and calls `applyHighlights`.

---

## 7. Annotation Popover

**File**: `/src/components/reader/annotation-popover.tsx`

Shown when the user selects text. Appears near the selection.

```tsx
"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnnotationPopoverProps {
  selection: {
    text: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
  };
  onHighlight: (color: string, isPublic: boolean) => void;
  onNote: (color: string, noteText: string, isPublic: boolean) => void;
  onClose: () => void;
}

const COLORS = [
  { name: 'yellow', class: 'bg-yellow-300', label: 'Yellow' },
  { name: 'green', class: 'bg-green-300', label: 'Green' },
  { name: 'blue', class: 'bg-blue-300', label: 'Blue' },
  { name: 'pink', class: 'bg-pink-300', label: 'Pink' },
  { name: 'purple', class: 'bg-purple-300', label: 'Purple' },
];

export function AnnotationPopover({ selection, onHighlight, onNote, onClose }: AnnotationPopoverProps) {
  const [mode, setMode] = useState<'color' | 'note'>('color');
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [noteText, setNoteText] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Position popover above the selection
  const top = selection.rect.top - 60 + window.scrollY;
  const left = selection.rect.left + selection.rect.width / 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed z-50 -translate-x-1/2 rounded-lg bg-popover p-3 shadow-lg border"
        style={{ top, left }}
      >
        {mode === 'color' ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setSelectedColor(c.name);
                    onHighlight(c.name, isPublic);
                    onClose();
                  }}
                  className={`h-6 w-6 rounded-full ${c.class} border-2 ${
                    selectedColor === c.name ? 'border-foreground' : 'border-transparent'
                  } hover:scale-110 transition-transform`}
                  title={`Highlight ${c.label}`}
                />
              ))}
              <div className="mx-1 w-px bg-border" />
              <button
                onClick={() => setMode('note')}
                className="text-sm text-muted-foreground hover:text-foreground px-2"
                title="Add note"
              >
                + Note
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              Share with community
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-64">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              className="w-full resize-none rounded border bg-background p-2 text-sm"
              rows={3}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded"
                />
                Share with community
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setMode('color')}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onNote(selectedColor, noteText, isPublic);
                    onClose();
                  }}
                  disabled={!noteText.trim()}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## 8. Annotation Notes Display

**File**: `/src/components/reader/annotation-notes.tsx`

Notes (annotations with `type: 'note'`) appear as small indicators in the right margin.

```tsx
interface AnnotationNotesProps {
  annotations: AnnotationPayload[];
  contentRef: React.RefObject<HTMLElement | null>;
  userId: number;
  onDelete: (annotationId: number) => void;
}
```

### Behavior

- For each annotation with `type: 'note'`, calculate its vertical position based on where it appears in the content
- Render a small colored dot in the right margin at that position
- On click: expand into a small card showing:
  - Author username
  - Timestamp
  - Note text
  - Delete button (only for own notes)
- On mobile: notes appear as inline expandable sections below the highlighted text (margins are too narrow)

---

## 9. Community Toggle (Updated from Brief 07)

**File**: `/src/components/reader/community-toggle.tsx`

Update the placeholder from Brief 07 to be fully functional:

```tsx
"use client";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

export function CommunityToggle({
  enabled,
  onToggle,
  annotationCount,
  activeReaders,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  annotationCount: number;
  activeReaders: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onToggle} />
        <Label className="text-sm text-muted-foreground">
          Community highlights ({annotationCount})
        </Label>
      </div>
      {activeReaders > 1 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{activeReaders} reading now</span>
        </div>
      )}
    </div>
  );
}
```

---

## 10. API Routes

### GET /api/studies/[id]/annotations

**File**: `/src/app/api/studies/[id]/annotations/route.ts`

```typescript
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const studyId = parseInt(id, 10);

  // Get user's own annotations + public annotations from others
  const annotations = db.prepare(`
    SELECT a.*, u.username
    FROM annotations a
    JOIN users u ON u.id = a.user_id
    WHERE a.study_id = ?
      AND (a.user_id = ? OR a.is_public = 1)
    ORDER BY a.start_offset ASC
  `).all(studyId, session.userId);

  return Response.json({ annotations });
}
```

### POST /api/studies/[id]/annotations

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const studyId = parseInt(id, 10);
  const body = await request.json();

  const { type, color, start_offset, end_offset, selected_text, note_text, is_public } = body;

  // Validate
  if (!type || !['highlight', 'note'].includes(type)) {
    return Response.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (type === 'note' && !note_text?.trim()) {
    return Response.json({ error: 'Note text required' }, { status: 400 });
  }

  const result = db.prepare(`
    INSERT INTO annotations (study_id, user_id, type, color, start_offset, end_offset, selected_text, note_text, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studyId,
    session.userId,
    type,
    color || 'yellow',
    start_offset,
    end_offset,
    selected_text,
    note_text || null,
    is_public ? 1 : 0
  );

  const annotation = db.prepare(`
    SELECT a.*, u.username
    FROM annotations a
    JOIN users u ON u.id = a.user_id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  // Broadcast via WebSocket (if public)
  if (is_public) {
    // Import and call broadcastAnnotationCreated
    // This requires the WebSocket server to be accessible from the API route
    // See "Integration with API Routes" section below
  }

  return Response.json({ annotation }, { status: 201 });
}
```

### DELETE /api/studies/[id]/annotations/[annotationId]

**File**: `/src/app/api/studies/[id]/annotations/[annotationId]/route.ts`

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, annotationId } = await params;
  const studyId = parseInt(id, 10);
  const annId = parseInt(annotationId, 10);

  // Only allow deleting own annotations
  const annotation = db.prepare(
    'SELECT * FROM annotations WHERE id = ? AND user_id = ? AND study_id = ?'
  ).get(annId, session.userId, studyId);

  if (!annotation) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  db.prepare('DELETE FROM annotations WHERE id = ?').run(annId);

  // Broadcast deletion via WebSocket
  // broadcastAnnotationDeleted(studyId, annId);

  return Response.json({ success: true });
}
```

---

## 11. Integration: WebSocket Broadcasts from API Routes

The WebSocket server runs in the same process as Next.js (via the custom server). To broadcast from API routes:

**Option A (Recommended)**: Use a shared module-level reference.

```typescript
// /src/lib/ws/broadcaster.ts
import type { AnnotationPayload } from './types';

type BroadcastFn = (studyId: number, annotation: AnnotationPayload) => void;
type DeleteFn = (studyId: number, annotationId: number) => void;

let _broadcastCreated: BroadcastFn | null = null;
let _broadcastDeleted: DeleteFn | null = null;

export function registerBroadcasters(created: BroadcastFn, deleted: DeleteFn) {
  _broadcastCreated = created;
  _broadcastDeleted = deleted;
}

export function broadcastAnnotationCreated(studyId: number, annotation: AnnotationPayload) {
  _broadcastCreated?.(studyId, annotation);
}

export function broadcastAnnotationDeleted(studyId: number, annotationId: number) {
  _broadcastDeleted?.(studyId, annotationId);
}
```

In `server.ts`, after setting up the WebSocket server, call `registerBroadcasters(...)` with the actual broadcast functions from the WS server module.

In API routes, import from `broadcaster.ts` and call the functions.

---

## 12. Integration with Study Reader (Brief 07)

Update the `StudyReader` component from Brief 07 to include the annotation layer:

```tsx
// In study-reader.tsx, add:
import { useStudyAnnotations } from '@/lib/hooks/use-study-annotations';
import { useTextSelection } from '@/lib/hooks/use-text-selection';
import { AnnotationPopover } from './annotation-popover';
import { applyHighlights } from './highlight-layer';
import { AnnotationNotes } from './annotation-notes';
import { CommunityToggle } from './community-toggle';

// Inside the component:
const contentRef = useRef<HTMLDivElement>(null);
const [showCommunity, setShowCommunity] = useState(false);

const {
  annotations,
  loading: annotationsLoading,
  connected,
  activeReaders,
  createAnnotation,
  deleteAnnotation,
} = useStudyAnnotations({
  studyId: study.id,
  userId: userId!,
  showCommunity,
});

const { selection, clearSelection } = useTextSelection(contentRef);

// Re-apply highlights when annotations change
useEffect(() => {
  if (contentRef.current && !annotationsLoading) {
    applyHighlights(contentRef.current, annotations, userId!);
  }
}, [annotations, annotationsLoading, userId]);
```

---

## Verification Steps

After implementation, verify:

1. **Custom server starts**: `npm run dev` starts the combined HTTP + WebSocket server
2. **WebSocket connects**: Open a study page — check browser console for WebSocket connection
3. **Text selection**: Select text in the study — annotation popover appears
4. **Highlight creation**: Click a color — text gets highlighted, API returns 201
5. **Note creation**: Click "+ Note", type text, save — note appears in margin
6. **Persistence**: Reload page — all annotations still visible
7. **Community toggle**: Toggle on — see other users' public annotations
8. **Real-time**: Open same study in two browser tabs. Create annotation in one — appears in the other instantly
9. **Delete**: Click delete on own annotation — removed from UI and database
10. **Optimistic UI**: Create annotation — appears instantly before API response
11. **Graceful degradation**: If WebSocket disconnects, annotations still work via REST (just no real-time)
12. **Mobile**: Text selection works on touch devices, popover positions correctly
13. **Presence**: Active reader count updates as tabs open/close

---

## Dependencies to Install

```bash
npm install ws tsx
npm install --save-dev @types/ws
# Shadcn components needed:
npx shadcn@latest add switch label popover
```

---

## Notes

- Character offsets are calculated relative to the rendered text content of the content container. If study content is edited after annotations are created, offsets may become invalid. The `selected_text` field provides a fallback — use it to search for the text if offsets don't match.
- The WebSocket server must be in the same process as Next.js for the broadcaster pattern to work. This is guaranteed by the custom server approach.
- Railway's $5/mo plan supports persistent WebSocket connections. No special configuration needed.
- For production, consider adding rate limiting to annotation creation (e.g., max 50 annotations per user per study).
