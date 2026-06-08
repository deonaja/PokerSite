'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Circle } from 'lucide-react'
import Button from './Button'
import Sheet from './Sheet'
import { useLoans } from '@/lib/useLoans'
import { requestLoan, approveLoan, declineLoan, cancelLoan, repayLoan } from '@/lib/actions/loans'
import type { LoanCandidate } from '@/lib/types'

const fmt = (n: number) => n.toLocaleString('id-ID')

// Peer-to-peer loan overlay for the dashboard. Polls /api/loans (per-user) and
// surfaces: an incoming request to approve (lender), a borrow banner + request
// sheet (short-stacked borrower), repay control (borrower), and indicators for
// any open loan on either side. Loans are blocked during a live session.
export default function LoanWidget() {
  const loans = useLoans()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [lender, setLender] = useState<LoanCandidate | null>(null)
  const [amount, setAmount] = useState('')

  // Reset the picker whenever the sheet closes.
  useEffect(() => {
    if (!requestOpen) { setLender(null); setAmount('') }
  }, [requestOpen])

  if (!loans || !loans.loggedIn) return null

  const { balance, buyIn, sessionActive, canBorrow, candidates, incoming, myBorrow, myLend } = loans

  function act(fn: () => Promise<{ success: true } | { error: string }>, onOk?: () => void) {
    if (isPending) return
    startTransition(async () => {
      setError(null)
      const r = await fn()
      if ('error' in r) setError(r.error)
      else { onOk?.(); router.refresh() }
    })
  }

  const req = incoming[0] // at most one (one open loan per player)
  const amountNum = Number(amount)
  const amountValid =
    lender != null && Number.isInteger(amountNum) && amountNum >= buyIn && amountNum <= lender.balance

  return (
    <div className="px-4 pt-3">
      {error && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="tutup" className="px-1 text-base">×</button>
        </div>
      )}

      {/* Incoming request — I'm the lender */}
      {req && (
        <div className="mb-2 rounded-lg border border-primary bg-accent p-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">{req.borrowerName}</span> minta pinjam{' '}
            <span className="font-mono tabular-nums text-warn">{fmt(req.amount)}</span>
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            Kalau setuju, {fmt(req.amount)} chip pindah dari saldo kamu ke dia. Ditarik balik di akhir musim.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button variant="primary" fullWidth disabled={isPending || sessionActive}
              onClick={() => act(() => approveLoan({ loanId: req.loanId }))}>
              {isPending ? '...' : 'Setujui'}
            </Button>
            <Button variant="secondary" fullWidth disabled={isPending}
              onClick={() => act(() => declineLoan({ loanId: req.loanId }))}>
              Tolak
            </Button>
          </div>
          {sessionActive && (
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">Selesaikan sesi dulu untuk menyetujui.</p>
          )}
        </div>
      )}

      {/* My pending request — waiting on the lender */}
      {myBorrow?.status === 'pending' && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <p className="min-w-0 text-sm text-foreground">
            Menunggu <span className="font-medium">{myBorrow.lenderName}</span> menyetujui pinjaman{' '}
            <span className="font-mono tabular-nums">{fmt(myBorrow.amount)}</span>
          </p>
          <Button variant="secondary" disabled={isPending}
            onClick={() => act(() => cancelLoan({ loanId: myBorrow.loanId }))}>
            Batalkan
          </Button>
        </div>
      )}

      {/* My active debt — repay */}
      {myBorrow?.status === 'active' && (
        <div className="mb-2 rounded-lg border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <Circle aria-hidden className="h-2.5 w-2.5 shrink-0 fill-destructive text-destructive" />
            <span>
              Ngutang ke <span className="font-medium">{myBorrow.lenderName}</span>:{' '}
              <span className="font-mono tabular-nums text-warn">{fmt(myBorrow.amount)}</span>
            </span>
          </p>
          <div className="mt-2.5">
            <Button variant="primary" fullWidth disabled={isPending || !myBorrow.canRepay || sessionActive}
              onClick={() => act(() => repayLoan({ loanId: myBorrow.loanId }))}>
              {isPending ? '...' : `Lunasi ${fmt(myBorrow.amount)}`}
            </Button>
            {sessionActive ? (
              <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">Selesaikan sesi dulu untuk melunasi.</p>
            ) : !myBorrow.canRepay && (
              <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                Bisa dilunasi saat saldo kamu ≥ {fmt(myBorrow.amount)}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* I'm the lender on an active loan */}
      {myLend && (
        <div className="mb-2 rounded-lg border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <Circle aria-hidden className="h-2.5 w-2.5 shrink-0 fill-success text-success" />
            <span>
              Minjemin <span className="font-medium">{myLend.borrowerName}</span>:{' '}
              <span className="font-mono tabular-nums text-success">{fmt(myLend.amount)}</span>
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            Ditarik balik otomatis saat {myLend.borrowerName} melunasi atau di akhir musim.
          </p>
        </div>
      )}

      {/* Borrow banner — short-stacked, eligible to request */}
      {canBorrow && (
        <div className="mb-2 rounded-lg border border-warn/60 bg-accent p-3">
          <p className="text-sm text-foreground">
            Saldo kamu <span className="font-mono tabular-nums text-warn">{fmt(balance)}</span> di bawah buy-in{' '}
            <span className="font-mono tabular-nums">{fmt(buyIn)}</span>.
          </p>
          <div className="mt-2.5">
            <Button variant="primary" fullWidth disabled={candidates.length === 0}
              onClick={() => setRequestOpen(true)}>
              Minta pinjaman
            </Button>
            {candidates.length === 0 && (
              <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                Belum ada pemain yang bisa meminjamkan.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Request sheet — pick a lender + amount */}
      <Sheet isOpen={requestOpen} onClose={() => !isPending && setRequestOpen(false)} title="Minta pinjaman">
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">
          Pilih pemberi pinjaman, lalu jumlahnya (minimal {fmt(buyIn)}). Mereka harus menyetujui dulu.
        </p>

        <div className="mb-3 flex flex-col gap-1.5">
          {candidates.map((c) => {
            const selected = lender?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => { setLender(c); setAmount(String(buyIn)) }}
                className={
                  'flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors ' +
                  (selected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-[var(--bg-elevated)]')
                }
              >
                <span className="truncate text-sm text-foreground">{c.name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
                  maks {fmt(c.balance)}
                </span>
              </button>
            )
          })}
        </div>

        {lender && (
          <div className="mb-4">
            <label htmlFor="loan-amount" className="mb-1 block text-xs text-[var(--text-tertiary)]">
              Jumlah ({fmt(buyIn)}–{fmt(lender.balance)})
            </label>
            <input
              id="loan-amount"
              type="number"
              inputMode="numeric"
              min={buyIn}
              max={lender.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-[var(--bg-elevated)] px-3 font-mono tabular-nums text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        )}

        <Button
          variant="primary"
          fullWidth
          disabled={isPending || !amountValid}
          onClick={() =>
            lender &&
            act(() => requestLoan({ lenderId: lender.id, amount: amountNum }), () => setRequestOpen(false))
          }
        >
          {isPending ? '...' : 'Ajukan pinjaman'}
        </Button>
      </Sheet>
    </div>
  )
}
