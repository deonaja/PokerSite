'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/Button'
import { endSeason } from '@/lib/actions/season'

export default function SeasonEndConfirm({ seasonId }: { seasonId: string }) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const stickyBottom: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '480px',
    padding: '0.75rem 1rem',
    paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
    borderTop: '1px solid var(--border-subtle)',
    background: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await endSeason(seasonId)
      if (result && 'error' in result) {
        setError(result.error)
        setConfirmed(false)
        return
      }
      router.push('/season/new')
    })
  }

  return (
    <div style={stickyBottom}>
      {error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--accent-danger)', margin: 0, textAlign: 'center' }}>{error}</p>
      )}
      {confirmed && !isPending && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--accent-warn)', margin: 0, textAlign: 'center' }}>
          Yakin? Balance semua pemain akan di-reset.
        </p>
      )}
      <Button
        variant={confirmed ? 'danger' : 'primary'}
        fullWidth
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? 'Memproses...' : confirmed ? 'Ya, Akhiri Musim' : 'Akhiri Musim'}
      </Button>
    </div>
  )
}
