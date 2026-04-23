'use client'

let timer: ReturnType<typeof setTimeout> | null = null

export function scheduleCameraSave(
  boardId: string,
  camera: { x: number; y: number; zoom: number }
): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    timer = null
    try {
      await fetch(`/api/bench/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_x: camera.x,
          camera_y: camera.y,
          camera_zoom: camera.zoom,
        }),
      })
    } catch {
      // non-fatal — camera will be re-saved on next change
    }
  }, 1500)
}
