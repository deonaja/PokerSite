// Tur Tamu stop 4 — frozen, read-only replica of the live session screen.
// No DB access at all: TourSessionView renders example data only.
import TourHeader from '@/components/tour/TourHeader'
import TourSessionView from '@/components/tour/TourSessionView'
import TourOverlay from '@/components/TourOverlay'

export default function TourSesiPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TourHeader />
      <main className="flex-1">
        <TourSessionView />
      </main>
      <TourOverlay />
    </div>
  )
}
