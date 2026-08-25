// Tur Tamu stop 5 (the focal moment) — frozen, read-only replica of the
// end-session recap with a deliberate chip-count mismatch so the warning
// always shows. No DB access: TourSessionEndView renders example data only.
import TourHeader from '@/components/tour/TourHeader'
import TourSessionEndView from '@/components/tour/TourSessionEndView'
import TourOverlay from '@/components/TourOverlay'

export default function TourSesiEndPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TourHeader />
      <main className="flex-1">
        <TourSessionEndView />
      </main>
      <TourOverlay />
    </div>
  )
}
