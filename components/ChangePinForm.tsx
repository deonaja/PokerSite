'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { changePin } from '@/lib/actions/players'
import Button from './Button'

export default function ChangePinForm() {
  const router = useRouter()
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const inputClass =
    'w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-4 py-3 text-sm text-foreground outline-none font-mono'

  const labelClass =
    'mb-2 text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground'

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await changePin({ oldPin, newPin, newPinConfirm })
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col px-4 pt-12 pb-8 gap-6">
        <div>
          <h1 className="text-lg font-medium text-foreground">
            PIN berhasil diubah
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gunakan PIN baru kamu saat login berikutnya.
          </p>
        </div>
        <Button type="button" fullWidth onClick={() => router.push('/')}>
          Kembali ke dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-4 pt-12 pb-8 gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex min-h-11 min-w-11 items-center p-0 text-muted-foreground"
        >
          <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-medium text-foreground">
          Ganti PIN
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className={labelClass}>
            PIN lama
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={oldPin}
            disabled={!isHydrated || isPending}
            onChange={(e) => setOldPin(e.target.value)}
            placeholder="PIN saat ini"
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        <div>
          <p className={labelClass}>
            PIN baru
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            disabled={!isHydrated || isPending}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="4–6 digit"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        <div>
          <p className={labelClass}>
            Konfirmasi PIN baru
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPinConfirm}
            disabled={!isHydrated || isPending}
            onChange={(e) => setNewPinConfirm(e.target.value)}
            placeholder="Ulangi PIN baru"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-[0.8125rem] text-destructive">{error}</p>
        )}

        <Button
          type="button"
          fullWidth
          className="h-12 text-base font-semibold uppercase tracking-wide"
          disabled={!isHydrated || isPending || !oldPin || !newPin || !newPinConfirm}
          onClick={handleSubmit}
        >
          {isPending ? 'Menyimpan…' : 'Simpan PIN'}
        </Button>
      </div>
    </div>
  )
}
