import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BalanceDisplay from '../BalanceDisplay'
import Button from '../Button'
import PixelIcon from '../PixelIcon'
import Avatar from '../Avatar'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'

interface MockRecapRow {
  id: string
  name: string
  avatarColor: string
  isDealer: boolean
  originalBalance: number
  newBalance: number
  contributed: number
  stack: number
}

const ROWS: MockRecapRow[] = [
  { id: 'rian', name: 'Rian', avatarColor: '#ffe800', isDealer: true, originalBalance: 300, newBalance: 450, contributed: 100, stack: 250 },
  { id: 'yoga', name: 'Yoga', avatarColor: '#00d0d0', isDealer: false, originalBalance: 150, newBalance: -60, contributed: 300, stack: 90 },
  { id: 'dimas', name: 'Dimas', avatarColor: '#e850c0', isDealer: false, originalBalance: 180, newBalance: 230, contributed: 200, stack: 250 },
]

const EXPECTED_TOTAL = ROWS.reduce((sum, r) => sum + r.contributed, 0)
const INPUT_TOTAL = ROWS.reduce((sum, r) => sum + r.stack, 0)
const CHIP_DIFF = INPUT_TOTAL - EXPECTED_TOTAL

// Tur Tamu stop 5 — the focal moment of the tour: a frozen recap screen with
// a deliberate chip-count mismatch, so the total-chip warning (the thing
// that proves this app handles a real, physical, error-prone night rather
// than just tallying points) is always visible regardless of when someone
// happens to visit. Confirm is disabled — settling is a real write, and
// this stop is read-only by design.
export default function TourSessionEndView() {
  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2.5">
        <Link href="/tur/sesi" className="flex min-h-11 min-w-11 items-center bg-transparent text-[var(--tt-cyan)]">
          <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
        </Link>
        <span className="flex items-center gap-2 text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
          <PixelIcon name="flag" size={16} className="text-[var(--tt-cyan)]" /> Konfirmasi
        </span>
        <span className="ml-auto text-sm uppercase tracking-wide text-[var(--text-tertiary)]">Contoh</span>
      </div>

      <div className="px-3 pt-5">
        <p className="mb-3 text-base uppercase tracking-[0.1em] text-[var(--text-secondary)]">Recap</p>

        <div className="mb-5 flex flex-col gap-2.5">
          {ROWS.map((r) => {
            const delta = r.newBalance - r.originalBalance
            return (
              <Card key={r.id} className="px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <Avatar name={r.name} color={r.avatarColor} size={32} />
                  <span className="min-w-0 truncate text-lg uppercase tracking-wide text-[var(--tt-white)]">{r.name}</span>
                  {r.isDealer && <Badge className="px-1.5 py-0.5"><PixelIcon name="star" size={11} /></Badge>}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-sm">
                  <BalanceDisplay balance={r.originalBalance} />
                  <span className="text-[var(--text-tertiary)]">→</span>
                  <BalanceDisplay balance={r.newBalance} />
                  <span className={delta >= 0 ? 'text-success' : 'text-destructive'}>
                    ({delta >= 0 ? '+' : ''}
                    {delta})
                  </span>
                </div>
              </Card>
            )
          })}
        </div>

        <Card data-tour="tour-warning" className="mb-4 border-warn px-4 py-3.5">
          <div className="mb-1 flex justify-between text-[0.8125rem]">
            <span className="text-muted-foreground">Total chip seharusnya</span>
            <span className="font-mono text-foreground">{EXPECTED_TOTAL}</span>
          </div>
          <div className="mb-2 flex justify-between text-[0.8125rem]">
            <span className="text-muted-foreground">Total input</span>
            <span className="font-mono text-foreground">{INPUT_TOTAL}</span>
          </div>
          <p className="m-0 flex items-start gap-1.5 border-t border-border pt-2 text-[0.8125rem] text-warn">
            <PixelIcon name="warn" size={13} className="mt-px shrink-0" />
            <span>
              Selisih {CHIP_DIFF > 0 ? '+' : ''}
              {CHIP_DIFF}. Chip fisik ga selalu pas — confirm tetap atau revisi, keputusan lo.
            </span>
          </p>
        </Card>
      </div>

      <div className="fixed bottom-0 left-1/2 flex w-full max-w-[480px] -translate-x-1/2 gap-3 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Link href="/tur/sesi" className="w-full">
          <Button variant="secondary" fullWidth>Back</Button>
        </Link>
        <Button variant="primary" fullWidth disabled className="h-12 bg-[var(--tt-yellow)] text-black">
          Confirm
        </Button>
      </div>
    </div>
  )
}
