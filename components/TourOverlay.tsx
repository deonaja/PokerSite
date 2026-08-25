'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import PixelIcon from './PixelIcon'
import {
  TOUR_STEPS,
  TOUR_CHANGED_EVENT,
  isTourActive,
  getTourStepIndex,
  setTourStepIndex,
  endTour,
} from '@/lib/tour'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const CAPTION_GAP = 12
const VIEWPORT_MARGIN = 12
// If the target has less than this much room below it, treat it as "near the
// bottom" and float the caption above it instead of docking at the screen edge.
const NEAR_BOTTOM_THRESHOLD = 210

// Cross-route coach-mark tour. Mounted on every page that can be a tour stop
// (/identity, /tur/dashboard, /tur/sesi, /tur/sesi/end). Stays invisible
// unless a tour is active AND the current step's route matches this page —
// so it's safe to mount unconditionally, no route wiring needed elsewhere.
export default function TourOverlay() {
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [ready, setReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function syncFromStorage() {
    setActive(isTourActive())
    setStepIndex(getTourStepIndex())
  }

  useEffect(() => {
    syncFromStorage()
    window.addEventListener(TOUR_CHANGED_EVENT, syncFromStorage)
    return () => window.removeEventListener(TOUR_CHANGED_EVENT, syncFromStorage)
  }, [])

  const step = TOUR_STEPS[stepIndex]
  const onThisRoute = active && step != null && step.route === pathname

  useEffect(() => {
    if (!onThisRoute) {
      setRect(null)
      setReady(false)
      return
    }
    if (!step.target) {
      setRect(null)
      setReady(true)
      return
    }

    setReady(false)
    let cancelled = false
    let tries = 0

    function measure(): boolean {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step!.target}"]`)
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (!cancelled) {
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        setReady(true)
      }
      return true
    }

    function tick() {
      if (cancelled) return
      // Give the destination page a moment to mount its data-tour target
      // after a client-side route change (server fetch + render can lag a
      // couple frames behind the navigation).
      if (measure() || tries++ > 40) return
      timerRef.current = setTimeout(tick, 75)
    }
    tick()

    function onScrollResize() {
      measure()
    }
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onThisRoute, step?.target, step?.route])

  if (!onThisRoute || !step) return null

  const isLast = stepIndex === TOUR_STEPS.length - 1
  const stepNumber = Math.min(stepIndex + 1, TOUR_STEPS.length - 1)

  function handleNext() {
    const nextIndex = stepIndex + 1
    if (nextIndex >= TOUR_STEPS.length) {
      endTour()
      router.push('/identity')
      return
    }
    const next = TOUR_STEPS[nextIndex]
    setTourStepIndex(nextIndex)
    setStepIndex(nextIndex)
    if (next.route !== pathname) router.push(next.route)
  }

  function handleExit() {
    endTour()
    router.push('/identity')
  }

  // Dock the caption at the bottom of the screen by default — matches the
  // app's own sheet/sticky-CTA convention and, unlike anchoring beside the
  // target, never depends on guessing the target's or caption's height. The
  // one exception: when the target itself sits near the bottom (e.g. the
  // sticky "Mulai Sesi" CTA), docking there would cover it, so the caption
  // floats just above the target instead.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844
  let captionBottom = `calc(${VIEWPORT_MARGIN}px + env(safe-area-inset-bottom))`
  if (rect) {
    const spaceBelowTarget = vh - (rect.top + rect.height)
    // Only float above the target when it's a compact, bottom-docked element
    // (like the sticky "Mulai Sesi" CTA). A tall target (e.g. a long player
    // list) can also read as "near the bottom" by this measure, but floating
    // above it there would push the caption mostly off-screen — default dock
    // handles that case correctly instead.
    const isCompactAndLow = rect.height < vh * 0.5 && spaceBelowTarget < NEAR_BOTTOM_THRESHOLD
    if (isCompactAndLow) {
      captionBottom = `${Math.max(VIEWPORT_MARGIN, vh - rect.top + CAPTION_GAP)}px`
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Tur: ${step.title}`}>
      {/* Scrim with a cyan-ringed cutout over the target (or a flat dim when centered) */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed border-2 border-[var(--tt-cyan)] transition-all duration-200 ease-out"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.78)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-black/78" />
      )}

      {/* Caption card — docked bottom by default, see captionBottom above */}
      {ready && (
        <div
          className="fixed left-1/2 z-[61] w-full max-w-[480px] -translate-x-1/2 px-3 transition-[bottom] duration-200 ease-out"
          style={{ bottom: captionBottom }}
        >
          <div className="border-2 border-[var(--tt-cyan)] bg-black px-4 py-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm uppercase tracking-[0.1em] text-[var(--tt-yellow)]">
                {isLast ? 'Selesai' : `Tur ${stepNumber}/${TOUR_STEPS.length - 1}`}
              </span>
              <button
                type="button"
                onClick={handleExit}
                className="min-h-6 shrink-0 text-sm uppercase tracking-wide text-[var(--text-tertiary)] underline-offset-4 hover:text-[var(--tt-red)] hover:underline"
              >
                Keluar
              </button>
            </div>
            <p className="m-0 mb-1 text-lg uppercase tracking-wide text-[var(--tt-white)]">{step.title}</p>
            <p className="font-read m-0 mb-3.5 text-sm leading-relaxed text-[var(--text-secondary)]">{step.body}</p>
            <button
              type="button"
              onClick={handleNext}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 bg-[var(--tt-yellow)] text-base font-semibold uppercase tracking-wide text-black transition-colors hover:bg-[color-mix(in_srgb,var(--tt-yellow)_86%,#000)]"
            >
              {step.ctaLabel}
              {!isLast && <PixelIcon name="chevronRight" size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
