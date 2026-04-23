// app/lib/ws/types.ts
import type { AnnotationPayload } from '@/lib/db/types';

export type { AnnotationPayload };

// Client → Server messages
export type ClientMessage =
  | { type: 'join'; studyId: number }
  | { type: 'leave'; studyId: number }
  | { type: 'ping' };

// Server → Client messages
export type ServerMessage =
  | { type: 'annotation:created'; annotation: AnnotationPayload }
  | { type: 'annotation:deleted'; annotationId: number; studyId: number }
  | { type: 'presence:update'; studyId: number; activeReaders: number }
  | { type: 'pong' }
  | { type: 'error'; message: string };
