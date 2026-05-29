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
    <div className="fixed bottom-0 left-1/2 flex w-full max-w-[480px] -translate-x-1/2 flex-col gap-2 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {error && (
        <p className="m-0 text-center text-sm text-destructive">{error}</p>
      )}
      {confirmed && !isPending && (
        <p className="m-0 text-center text-[0.8125rem] text-warn">
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
