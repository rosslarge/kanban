import { useEffect } from 'react'

/**
 * Tracks the mouse and writes `--mouse-x` / `--mouse-y` (as percentages) to
 * `document.documentElement.style` on every pointer move, throttled via rAF.
 * These are consumed by the `.spotlight` layer in BackgroundAtmosphere.
 * Silently does nothing when the user prefers reduced motion.
 */
export function useMouseSpotlight() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let rafId: number

    function onMove(e: PointerEvent) {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`)
        document.documentElement.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`)
      })
    }

    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(rafId)
    }
  }, [])
}
