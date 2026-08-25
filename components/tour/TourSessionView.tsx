import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Button from '../Button'
import PixelIcon from '../PixelIcon'
import Avatar from '../Avatar'
import { Badge } from '../ui/badge'

interface MockParticipant {
  id: string
  name: string
  avatarColor: string
  isDealer: boolean
  balance: number
  rebuyCount: number
}

const BUY_IN = 100

const PARTICIPANTS: MockParticipant[] = [
  { id: 'rian', name: 'Rian', avatarColor: '#ffe800', isDealer: true, balance: 340, rebuyCount: 0 },
  { id: 'yoga', name: 'Yoga', avatarColor: '#00d0d0', isDealer: false, balance: 60, rebuyCount: 2 },
  { id: 'dimas', name: 'Dimas', avatarColor: '#e850c0', isDealer: false, balance: 220, rebuyCount: 1 },
]

// Tur Tamu stop 4 — a frozen, representative replica of the live session
// screen. No usePoll, no server actions: this is example data, not a real
// group's game. Rebuy/Undo stay visible (same components, same layout) but
// disabled, so the tour visitor sees exactly what the screen looks like
// without ever writing to the database.
export default function TourSessionView() {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Link href="/tur/dashboard" className="flex min-h-11 min-w-11 items-center justify-center text-[var(--tt-cyan)]">
            <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="flex items-center gap-2 text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
              <PixelIcon name="cards" size={16} className="text-[var(--tt-cyan)]" /> Sesi Aktif
            </span>
            <span className="flex items-center gap-2 text-sm uppercase tracking-wide text-[var(--text-secondary)]">
              <span className="tabular-nums text-[var(--tt-cyan)]" aria-label="Durasi sesi">00:42:10</span>
              <span>· Contoh</span>
            </span>
          </div>
        </div>
        <Link
          href="/tur/sesi/end"
          className="flex min-h-10 items-center justify-center border-2 border-[var(--tt-red)] bg-[color-mix(in_srgb,var(--tt-red)_20%,#000)] px-4 text-base uppercase tracking-[0.1em] text-[var(--tt-red)] transition-colors hover:bg-[color-mix(in_srgb,var(--tt-red)_32%,#000)]"
        >
          End
        </Link>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {PARTICIPANTS.map((p, i) => {
          const lowBalance = p.balance < BUY_IN
          return (
            <div
              key={p.id}
              data-tour={i === 0 ? 'tour-rebuy' : undefined}
              className={'rounded-lg border px-4 py-3.5 ' + (p.isDealer ? 'border-primary bg-accent' : 'border-border bg-card')}
            >
              <div className="flex items-center gap-2.5">
                <Avatar name={p.name} color={p.avatarColor} size={36} />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-foreground">{p.name}</span>
                {p.isDealer && <Badge className="inline-flex items-center gap-1"><PixelIcon name="star" size={11} />DEALER</Badge>}
              </div>

              <div className="mt-2 mb-2.5 flex items-baseline gap-4 text-base uppercase tracking-wide">
                <span className="text-[var(--text-secondary)]">
                  Saldo{' '}
                  <span className={'tabular-nums ' + (lowBalance ? 'text-[var(--tt-yellow)]' : 'text-[var(--tt-cyan)]')}>{p.balance}</span>
                </span>
                <span className="text-[var(--text-secondary)]">
                  Rebuy <span className="tabular-nums text-[var(--tt-white)]">{p.rebuyCount}</span>
                </span>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" disabled className="min-h-11 flex-1 text-base">
                  Rebuy
                </Button>
                <Button variant="secondary" disabled className="min-h-11 flex-1 text-base">
                  Undo
                </Button>
              </div>
            </div>
          )
        })}

        <p className="mt-1 text-center text-sm uppercase tracking-wide text-[var(--text-tertiary)]">
          Mode tur — tombol dinonaktifin, cuma buat liat tampilannya
        </p>
      </div>
    </>
  )
}
