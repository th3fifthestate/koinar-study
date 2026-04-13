'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import type { Entity, EntityDetail, StudyEntityAnnotation } from '@/lib/db/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EntityLayerContextValue {
  // Data
  entityMap: Map<string, Entity>;
  annotationLookup: Map<string, string>; // surface_text (lowercase) -> entity_id
  annotationRegex: RegExp | null;

  // Toggle
  showAnnotations: boolean;
  setShowAnnotations: (v: boolean) => void;

  // Drawer
  drawerOpen: boolean;
  entityStack: string[];
  openDrawer: (entityId: string) => void;
  navigateToEntity: (entityId: string) => void;
  navigateBack: (toIndex?: number) => void;
  closeDrawer: () => void;

  // Detail cache (for drawer)
  getEntityDetail: (entityId: string) => EntityDetail | null;
  fetchEntityDetail: (entityId: string) => Promise<EntityDetail | null>;
}

const EntityLayerContext = createContext<EntityLayerContextValue | null>(null);

export function useEntityLayer() {
  const ctx = useContext(EntityLayerContext);
  if (!ctx) throw new Error('useEntityLayer must be used within EntityLayerProvider');
  return ctx;
}

export function useEntityLayerOptional() {
  return useContext(EntityLayerContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface EntityLayerProviderProps {
  annotations: StudyEntityAnnotation[];
  entities: Entity[];
  children: ReactNode;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function EntityLayerProvider({
  annotations,
  entities,
  children,
}: EntityLayerProviderProps) {
  // ── Data maps ──
  const entityMap = useMemo(
    () => new Map(entities.map((e) => [e.id, e])),
    [entities]
  );

  const { annotationLookup, annotationRegex } = useMemo(() => {
    const lookup = new Map<string, string>();
    const surfaces: string[] = [];

    for (const ann of annotations) {
      const key = ann.surface_text.toLowerCase();
      if (!lookup.has(key)) {
        lookup.set(key, ann.entity_id);
        surfaces.push(ann.surface_text);
      }
    }

    // Sort longest-first for greedy matching
    surfaces.sort((a, b) => b.length - a.length);

    const regex =
      surfaces.length > 0
        ? new RegExp(`\\b(${surfaces.map(escapeRegex).join('|')})\\b`, 'gi')
        : null;

    return { annotationLookup: lookup, annotationRegex: regex };
  }, [annotations]);

  // ── Toggle ──
  const [showAnnotations, setShowAnnotationsState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('koinar:entity-annotations-visible');
    if (stored === 'false') setShowAnnotationsState(false);
  }, []);

  const setShowAnnotations = useCallback((v: boolean) => {
    setShowAnnotationsState(v);
    localStorage.setItem('koinar:entity-annotations-visible', String(v));
  }, []);

  // ── Drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entityStack, setEntityStack] = useState<string[]>([]);

  const openDrawer = useCallback((entityId: string) => {
    setEntityStack([entityId]);
    setDrawerOpen(true);
  }, []);

  const navigateToEntity = useCallback((entityId: string) => {
    setEntityStack((prev) => [...prev, entityId]);
  }, []);

  const navigateBack = useCallback((toIndex?: number) => {
    setEntityStack((prev) => {
      if (toIndex !== undefined) return prev.slice(0, toIndex + 1);
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setEntityStack([]), 200);
  }, []);

  // ── Detail cache ──
  const detailCacheRef = useRef(new Map<string, EntityDetail>());

  const getEntityDetailCached = useCallback(
    (entityId: string): EntityDetail | null => {
      return detailCacheRef.current.get(entityId) ?? null;
    },
    []
  );

  const fetchEntityDetail = useCallback(
    async (entityId: string): Promise<EntityDetail | null> => {
      const cached = detailCacheRef.current.get(entityId);
      if (cached) return cached;

      try {
        const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}`);
        if (!res.ok) return null;
        const detail = (await res.json()) as EntityDetail;
        detailCacheRef.current.set(entityId, detail);
        return detail;
      } catch {
        return null;
      }
    },
    []
  );

  // ── Context value ──
  const value = useMemo<EntityLayerContextValue>(
    () => ({
      entityMap,
      annotationLookup,
      annotationRegex,
      showAnnotations,
      setShowAnnotations,
      drawerOpen,
      entityStack,
      openDrawer,
      navigateToEntity,
      navigateBack,
      closeDrawer,
      getEntityDetail: getEntityDetailCached,
      fetchEntityDetail,
    }),
    [
      entityMap,
      annotationLookup,
      annotationRegex,
      showAnnotations,
      setShowAnnotations,
      drawerOpen,
      entityStack,
      openDrawer,
      navigateToEntity,
      navigateBack,
      closeDrawer,
      getEntityDetailCached,
      fetchEntityDetail,
    ]
  );

  return (
    <EntityLayerContext.Provider value={value}>
      {children}
    </EntityLayerContext.Provider>
  );
}
