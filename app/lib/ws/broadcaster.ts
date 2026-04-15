// app/lib/ws/broadcaster.ts
// Module-level broadcaster pattern: the custom server registers the broadcast
// functions after setting up the WS server. API routes import and call them.
// This works because server.ts, API routes, and broadcaster.ts all run in the
// same Node.js process — module-level state is shared.

import type { AnnotationPayload } from '@/lib/db/types';

type BroadcastCreatedFn = (studyId: number, annotation: AnnotationPayload) => void;
type BroadcastDeletedFn = (studyId: number, annotationId: number) => void;

let _broadcastCreated: BroadcastCreatedFn | null = null;
let _broadcastDeleted: BroadcastDeletedFn | null = null;

/** Called once by server.ts after WS server setup. */
export function registerBroadcasters(
  created: BroadcastCreatedFn,
  deleted: BroadcastDeletedFn
): void {
  _broadcastCreated = created;
  _broadcastDeleted = deleted;
}

/** Broadcasts a new public annotation to all clients in the study room. */
export function broadcastAnnotationCreated(studyId: number, annotation: AnnotationPayload): void {
  _broadcastCreated?.(studyId, annotation);
}

/** Broadcasts an annotation deletion to all clients in the study room. */
export function broadcastAnnotationDeleted(studyId: number, annotationId: number): void {
  _broadcastDeleted?.(studyId, annotationId);
}
