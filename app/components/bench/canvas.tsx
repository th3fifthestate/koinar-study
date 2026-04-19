'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BenchCanvasContext, useCanvasCamera } from './canvas-camera'
import { ConnectionLayer } from './connection'
import { ClippingCard } from './clipping-card'
import { useBenchBoardContext } from './bench-board-context'
import { scheduleCameraSave } from '@/lib/bench/camera-persistence'
import { guardDrop } from '@/lib/bench/guard-drop'
import type { LicenseCapModalProps as GuardCapModalProps } from '@/lib/bench/guard-drop'
import { LicenseCapModal } from './license-cap-modal'
import { BoardOrientingCard } from './onboarding/board-orienting-card'
import { KeyboardCheatSheet } from './onboarding/keyboard-cheat-sheet'
import { useBenchKeyboardShortcuts } from '@/lib/hooks/use-bench-keyboard-shortcuts'
import type { BenchBoard, BenchClipping } from '@/lib/db/types'

interface BenchCanvasProps {
  board: BenchBoard
}

export function BenchCanvas({ board }: BenchCanvasProps) {
  const prefersReduced = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)

  const camControls = useCanvasCamera({
    x: board.camera_x,
    y: board.camera_y,
    zoom: board.camera_zoom,
  })
  const { camera, pan, zoomAtPoint, transformStyle } = camControls

  const boardState = useBenchBoardContext()
  const { clippings, connections, addClipping, deleteConnection, moveClipping, resizeClipping, deleteClipping, updateSourceRef, addConnection, isReadOnly } = boardState

  const [capModal, setCapModal] = useState<GuardCapModalProps | null>(null)
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false)
  const [selectedClippingId, setSelectedClippingId] = useState<string | null>(null)

  const [orientingDismissed, setOrientingDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(`bench:orienting:${board.id}`) === '1'
  })

  const handleOrientingDismiss = useCallback(() => {
    sessionStorage.setItem(`bench:orienting:${board.id}`, '1')
    setOrientingDismissed(true)
  }, [board.id])

  // Persist camera on change (debounced 1500ms)
  useEffect(() => {
    scheduleCameraSave(board.id, camera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, camera.x, camera.y, camera.zoom])

  // Keyboard shortcuts (global)
  useBenchKeyboardShortcuts({
    camReset: camControls.reset,
    onDuplicate: () => {
      if (!selectedClippingId) return
      const src = clippings.find(c => c.id === selectedClippingId)
      if (!src) return
      void addClipping({
        clipping_type: src.clipping_type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source_ref: JSON.parse(src.source_ref) as any,
        x: src.x + 24,
        y: src.y + 24,
      })
    },
    onDelete: () => {
      if (selectedClippingId) void deleteClipping(selectedClippingId)
    },
    onUndo: () => { /* undo: not yet implemented — requires setClippings in use-bench-board */ },
    onRedo: () => { /* redo: not yet implemented — requires setClippings in use-bench-board */ },
    nudge: (dx, dy) => {
      if (!selectedClippingId) return
      const c = clippings.find(cl => cl.id === selectedClippingId)
      if (!c) return
      void moveClipping(selectedClippingId, c.x + dx / camera.zoom, c.y + dy / camera.zoom)
    },
    onOpenExpanded: () => { /* placeholder — no expanded view implemented yet */ },
    onClearSelection: () => setSelectedClippingId(null),
    onFocusDrawerSearch: () => {
      window.dispatchEvent(new CustomEvent('bench:open-drawer', { detail: { tab: 'verses', focusSearch: true } }))
    },
    onToggleDrawer: () => window.dispatchEvent(new CustomEvent('bench:toggle-drawer')),
    onToggleTray: () => window.dispatchEvent(new CustomEvent('bench:toggle-tray')),
    onOpenCheatSheet: () => setCheatSheetOpen(true),
    isReadOnly,
  })

  // Keyboard: Space = pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        spaceHeld.current = true
        viewportRef.current?.classList.add('cursor-grab')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        if (!isPanning.current) {
          viewportRef.current?.classList.remove('cursor-grab')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Pointer: pan when Space held
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!spaceHeld.current) return
      isPanning.current = true
      lastPointer.current = { x: e.clientX, y: e.clientY }
      viewportRef.current?.setPointerCapture(e.pointerId)
      viewportRef.current?.classList.replace('cursor-grab', 'cursor-grabbing')
    },
    []
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return
      const dx = e.clientX - lastPointer.current.x
      const dy = e.clientY - lastPointer.current.y
      lastPointer.current = { x: e.clientX, y: e.clientY }
      pan(camera.x + dx, camera.y + dy)
    },
    [camera.x, camera.y, pan]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return
    isPanning.current = false
    viewportRef.current?.releasePointerCapture(e.pointerId)
    if (spaceHeld.current) {
      viewportRef.current?.classList.replace('cursor-grabbing', 'cursor-grab')
    } else {
      viewportRef.current?.classList.remove('cursor-grabbing')
    }
  }, [])

  // Wheel: Ctrl/Meta+wheel = zoom, bare wheel = pan when zoomed in
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      const vpX = e.clientX - rect.left
      const vpY = e.clientY - rect.top

      if (e.ctrlKey || e.metaKey) {
        const factor = 1 - e.deltaY * 0.005
        zoomAtPoint(vpX, vpY, camera.zoom * factor)
      } else if (camera.zoom !== 1) {
        pan(camera.x - e.deltaX, camera.y - e.deltaY)
      }
      // bare wheel at zoom=1 → let page scroll naturally (do nothing)
    },
    [camera.zoom, camera.x, camera.y, zoomAtPoint, pan]
  )

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // Drop target: accept bench-clip drags from SourceDrawer
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/bench-clip')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('application/bench-clip')
      if (!raw) return
      try {
        const payload = JSON.parse(raw) as {
          clipping_type: BenchClipping['clipping_type']
          source_ref: unknown
          recent_clip_id?: string
        }
        // Guard-drop: check per-board license caps before adding
        const ref = payload.source_ref as Record<string, unknown>
        const guard = guardDrop(
          {
            clippingType: payload.clipping_type,
            translation: typeof ref.translation === 'string' ? ref.translation : undefined,
            translations: Array.isArray(ref.translations) ? (ref.translations as string[]) : undefined,
          },
          { id: board.id, clippings }
        )
        if (!guard.ok) {
          setCapModal(guard.modalProps)
          return
        }

        const rect = viewportRef.current!.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - camera.x) / camera.zoom
        const worldY = (e.clientY - rect.top - camera.y) / camera.zoom
        void addClipping({
          clipping_type: payload.clipping_type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          source_ref: payload.source_ref as any,
          x: worldX,
          y: worldY,
        })
        if (payload.recent_clip_id) {
          void fetch(`/api/bench/recent-clips/${payload.recent_clip_id}`, { method: 'DELETE' })
        }
      } catch {
        // malformed drag payload — ignore
      }
    },
    [camera, addClipping, board.id, clippings]
  )

  // Dot grid opacity based on zoom (per 32a §1.2)
  const dotOpacity =
    camera.zoom >= 1 ? 0.1 : camera.zoom <= 0.6 ? 0 : ((camera.zoom - 0.6) / 0.4) * 0.1

  return (
    <BenchCanvasContext.Provider value={{ ...camControls, boardId: board.id }}>
      <div
        ref={viewportRef}
        className="relative overflow-hidden w-full h-full select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={onDragOver}
        onDrop={onDrop}
        aria-label="Study bench canvas"
        role="region"
      >
        {/* Transform plane */}
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: transformStyle }}
        >
          {/* Dot grid */}
          <div
            className="absolute pointer-events-none"
            style={{
              inset: '-5000px',
              opacity: dotOpacity,
              backgroundImage:
                'radial-gradient(circle, var(--stone-300, #c7bfb0) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden
          />

          {/* SVG connection layer (below cards) */}
          <ConnectionLayer
            connections={connections}
            clippings={clippings}
            onDelete={deleteConnection}
          />

          {/* Clipping cards */}
          {clippings.map((clipping) => (
            <ClippingCard
              key={clipping.id}
              clipping={clipping}
              boardId={board.id}
              onMove={moveClipping}
              onResize={resizeClipping}
              onDelete={deleteClipping}
              onAddConnection={addConnection}
              onUpdateSourceRef={updateSourceRef}
            />
          ))}
        </div>

        {clippings.length === 0 && !orientingDismissed && (
          <BoardOrientingCard onDismiss={handleOrientingDismiss} />
        )}
      </div>
      {capModal && (
        <LicenseCapModal
          {...capModal}
          onClose={() => setCapModal(null)}
        />
      )}
      <KeyboardCheatSheet open={cheatSheetOpen} onClose={() => setCheatSheetOpen(false)} />
    </BenchCanvasContext.Provider>
  )
}
