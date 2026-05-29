'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    boxSizing: 'border-box',
  }

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
          <h1 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            PIN berhasil diubah
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.125rem',
            cursor: 'pointer',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          Ganti PIN
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            style={inputStyle}
          />
        </div>

        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            style={inputStyle}
          />
        </div>

        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--accent-danger)', margin: 0 }}>{error}</p>
        )}

        <Button
          type="button"
          fullWidth
          disabled={!isHydrated || isPending || !oldPin || !newPin || !newPinConfirm}
          onClick={handleSubmit}
        >
          {isPending ? 'Menyimpan…' : 'Simpan PIN'}
        </Button>
      </div>
    </div>
  )
}
