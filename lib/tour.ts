// Guided read-only "Tur Tamu" — cross-route coach-mark walkthrough for a
// first-time device that wants to see what the app actually does before
// deciding to register. Progress is per-device (localStorage), mirrors the
// GUIDE_SEEN_KEY pattern in lib/guide.ts. No server state, no auth bypass:
// the tour only ever visits /identity (already public) and the /tur/* demo
// routes, which render real components fed frozen mock data instead of the
// live authenticated pages.
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from './safeStorage'

export const TOUR_ACTIVE_KEY = 'tour_active'
export const TOUR_STEP_KEY = 'tour_step'
export const TOUR_CHANGED_EVENT = 'tour-changed'

export interface TourStep {
  id: string
  route: string
  // data-tour attribute value to anchor the caption to. null = centered card
  // (no target on the page — used for the closing step).
  target: string | null
  title: string
  body: string
  ctaLabel: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'identity',
    route: '/identity',
    target: 'tour-identity',
    title: 'Ini kamu siapa',
    body: 'Semua orang login lewat sini — pilih nama dari daftar pemain grup, masukin PIN. Ga ada akun ribet, identitas doang.',
    ctaLabel: 'Lanjut',
  },
  {
    id: 'dashboard-saldo',
    route: '/tur/dashboard',
    target: 'tour-standings',
    title: 'Papan saldo',
    body: 'Saldo tiap pemain kesimpen permanen lintas sesi — ga ada lagi drama "lo masih utang berapa ya".',
    ctaLabel: 'Lanjut',
  },
  {
    id: 'dashboard-mulai',
    route: '/tur/dashboard',
    target: 'tour-start-cta',
    title: 'Mulai sesi',
    body: 'Pilih siapa main malam ini + siapa dealer. Dealer itu peran dibayar — bukan cuma bagi kartu doang.',
    ctaLabel: 'Lanjut',
  },
  {
    id: 'sesi-rebuy',
    route: '/tur/sesi',
    target: 'tour-rebuy',
    title: 'Rebuy sekali tap',
    body: 'Pas chip abis di meja, tap Rebuy — ke-catat + saldo kepotong seketika, ke-sync ke semua HP di meja dalam ±2 detik.',
    ctaLabel: 'Lanjut',
  },
  {
    id: 'sesi-end-recap',
    route: '/tur/sesi/end',
    target: 'tour-warning',
    title: 'Settle otomatis',
    body: 'Masukin stack akhir tiap orang, app yang ngitung semua. Kalau total chip fisik meleset dari catatan, muncul warning kayak gini — tetep bisa lanjut, keputusan di tangan lo.',
    ctaLabel: 'Lanjut',
  },
  {
    id: 'outro',
    route: '/tur/dashboard',
    target: null,
    title: 'Segitu dulu tur-nya',
    body: 'Masih ada profil (achievement), riwayat sesi, dan musim yang belum dipandu — explore sendiri abis daftar. Siap gabung?',
    ctaLabel: 'Daftar / Masuk',
  },
]

export function isTourActive(): boolean {
  return getLocalStorageItem(TOUR_ACTIVE_KEY) === '1'
}

export function getTourStepIndex(): number {
  const raw = getLocalStorageItem(TOUR_STEP_KEY)
  const n = raw ? parseInt(raw, 10) : 0
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(n, 0), TOUR_STEPS.length - 1)
}

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOUR_CHANGED_EVENT))
}

export function startTour(): void {
  setLocalStorageItem(TOUR_ACTIVE_KEY, '1')
  setLocalStorageItem(TOUR_STEP_KEY, '0')
  notifyChanged()
}

export function setTourStepIndex(index: number): void {
  setLocalStorageItem(TOUR_STEP_KEY, String(index))
  notifyChanged()
}

export function endTour(): void {
  removeLocalStorageItem(TOUR_ACTIVE_KEY)
  removeLocalStorageItem(TOUR_STEP_KEY)
  notifyChanged()
}
