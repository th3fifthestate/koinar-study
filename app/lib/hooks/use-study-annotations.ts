'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStudyWebSocket } from '@/lib/ws/client';
import type { AnnotationPayload } from '@/lib/ws/types';
import type { AnnotationColor } from '@/lib/db/types';

interface UseStudyAnnotationsOptions {
  studyId: number;
  isLoggedIn: boolean;
  showCommunity: boolean;
}

export function useStudyAnnotations({ studyId, isLoggedIn, showCommunity }: UseStudyAnnotationsOptions) {
  const [annotations, setAnnotations] = useState<AnnotationPayload[]>([]);
  const [activeReaders, setActiveReaders] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial annotations via REST
  useEffect(() => {
    if (!isLoggedIn) {
      setAnnotations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchAnnotations() {
      setLoading(true);
      try {
        const res = await fetch(`/api/studies/${studyId}/annotations`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAnnotations(data.annotations);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAnnotations();
    return () => { cancelled = true; };
  }, [studyId, isLoggedIn]);

  // Real-time updates via WebSocket
  const handleAnnotationCreated = useCallback((annotation: AnnotationPayload) => {
    setAnnotations((prev) => {
      if (prev.some((a) => a.id === annotation.id)) return prev;
      return [...prev, annotation];
    });
  }, []);

  const handleAnnotationDeleted = useCallback((annotationId: number) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  }, []);

  const { connected } = useStudyWebSocket({
    studyId,
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationDeleted: handleAnnotationDeleted,
    onPresenceUpdate: setActiveReaders,
  });

  // Filter based on showCommunity toggle
  const visibleAnnotations = annotations.filter((a) => {
    if (a.is_own) return true;
    if (showCommunity && a.is_public) return true;
    return false;
  });

  // Create annotation (optimistic)
  const createAnnotation = useCallback(
    async (data: {
      type: 'highlight' | 'note';
      color: AnnotationColor;
      start_offset: number;
      end_offset: number;
      selected_text: string;
      note_text?: string;
      is_public: boolean;
    }) => {
      const tempId = -Date.now();
      const tempAnnotation: AnnotationPayload = {
        id: tempId,
        study_id: studyId,
        is_own: true,
        username: '',
        ...data,
        note_text: data.note_text || null,
        is_public: data.is_public,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, tempAnnotation]);

      const res = await fetch(`/api/studies/${studyId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        setAnnotations((prev) => prev.filter((a) => a.id !== tempId));
        throw new Error('Failed to create annotation');
      }

      const created = await res.json();
      // Replace temp with real
      setAnnotations((prev) =>
        prev.map((a) => (a.id === tempId ? created.annotation : a))
      );

      return created.annotation as AnnotationPayload;
    },
    [studyId]
  );

  // Delete annotation (optimistic)
  const deleteAnnotation = useCallback(
    async (annotationId: number) => {
      // Capture snapshot inside the updater to avoid stale closure over annotations
      let snapshot: AnnotationPayload[] = [];
      setAnnotations((prev) => {
        snapshot = prev;
        return prev.filter((a) => a.id !== annotationId);
      });

      const res = await fetch(`/api/studies/${studyId}/annotations/${annotationId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setAnnotations(snapshot);
        throw new Error('Failed to delete annotation');
      }
    },
    [studyId]
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
