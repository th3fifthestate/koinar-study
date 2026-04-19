// app/lib/ws/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { unsealData } from 'iron-session';
import { sessionOptions } from '@/lib/auth/session';
import type { SessionData } from '@/lib/auth/session';
import { registerBroadcasters } from './broadcaster';
import { studyIsAccessible } from '@/lib/db/queries';
import type { ClientMessage, ServerMessage } from './types';
import type { AnnotationPayload } from '@/lib/db/types';

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  username: string;
  studyId: number | null;
}

const clients = new Map<WebSocket, ConnectedClient>();
const studyRooms = new Map<number, Set<WebSocket>>(); // studyId → Set<WebSocket>

/**
 * Parses the Cookie header from a WS upgrade request and decrypts the
 * iron-session cookie using unsealData. Returns null if missing or invalid.
 * Authentication happens here — no userId in query params.
 */
async function getSessionFromRequest(req: IncomingMessage): Promise<SessionData | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  // Parse "name=value; name2=value2" — split on first '=' only (values may contain '=')
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[name] = value;
  }

  const cookieValue = cookies[sessionOptions.cookieName];
  if (!cookieValue) return null;

  try {
    const session = await unsealData<SessionData>(cookieValue, {
      password: sessionOptions.password as string,
    });
    if (!session.userId || !session.isApproved) return null;
    return session;
  } catch {
    return null;
  }
}

export function setupWebSocketServer(server: Server) {
  // Use noServer mode and dispatch upgrades ourselves. If we passed `server`
  // directly, the `ws` library would attach its own upgrade listener that
  // destroys any socket whose path doesn't match /ws — including Next's
  // Turbopack HMR WebSocket (/_next/...). Killing the HMR socket in dev
  // leaves the client's RSC stream unclosed, so `await initialServerResponse`
  // inside the client hydrate() never resolves, so hydrateRoot is never
  // called, so the page stays non-interactive.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname: string | null = null;
    try {
      // req.url is a path, e.g. "/ws" or "/_next/..." — no host needed for pathname
      pathname = new URL(req.url || '/', 'http://localhost').pathname;
    } catch {
      pathname = req.url ?? null;
    }
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // Any other path (Next HMR, etc.) — do nothing; Next's own 'upgrade'
    // listener, or any other handler, will handle it. Multiple 'upgrade'
    // listeners coexist in Node.
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const session = await getSessionFromRequest(req);

    if (!session) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const client: ConnectedClient = {
      ws,
      userId: session.userId,
      username: session.username,
      studyId: null,
    };
    clients.set(ws, client);

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        handleMessage(ws, client, message);
      } catch {
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
      if (client.studyId !== null) {
        leaveRoom(ws, client.studyId);
      }
      clients.delete(ws);
    });
  });

  // Heartbeat: ping all clients every 30s to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  // Register broadcast functions with the broadcaster module so API routes can call them
  registerBroadcasters(broadcastAnnotationCreated, broadcastAnnotationDeleted);

  return wss;
}

function handleMessage(ws: WebSocket, client: ConnectedClient, message: ClientMessage) {
  switch (message.type) {
    case 'join': {
      const sid = (message as Record<string, unknown>).studyId;
      if (typeof sid !== 'number' || !Number.isInteger(sid) || sid <= 0) {
        sendToClient(ws, { type: 'error', message: 'Invalid studyId' });
        return;
      }
      // Verify user has access to this study (public or own private study)
      if (!studyIsAccessible(sid, client.userId)) {
        sendToClient(ws, { type: 'error', message: 'Study not found' });
        return;
      }
      if (client.studyId !== null) {
        leaveRoom(ws, client.studyId);
      }
      client.studyId = sid;
      joinRoom(ws, sid);
      break;
    }

    case 'leave': {
      if (client.studyId !== null) {
        leaveRoom(ws, client.studyId);
        client.studyId = null;
      }
      break;
    }

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
  broadcastPresence(studyId);
}

function leaveRoom(ws: WebSocket, studyId: number) {
  const room = studyRooms.get(studyId);
  if (!room) return;
  room.delete(ws);
  // Always broadcast updated presence count (including activeReaders: 0 on last leave)
  broadcastPresence(studyId);
  if (room.size === 0) {
    studyRooms.delete(studyId);
  }
}

function broadcastPresence(studyId: number) {
  const count = studyRooms.get(studyId)?.size ?? 0;
  broadcastToRoom(studyId, { type: 'presence:update', studyId, activeReaders: count });
}

export function broadcastAnnotationCreated(studyId: number, annotation: AnnotationPayload): void {
  broadcastToRoom(studyId, { type: 'annotation:created', annotation });
}

export function broadcastAnnotationDeleted(studyId: number, annotationId: number): void {
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
