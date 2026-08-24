'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from './Sheet'
import Button from './Button'
import Avatar, { CHIP_COLORS, colorForName } from './Avatar'
import { setAvatarColor } from '@/lib/actions/players'

interface Props {
  isOpen: boolean
  onClose: () => void
  name: string
  color: string | null
}

const HEX = /^#[0-9a-fA-F]{6}$/

export default function AvatarColorPicker({ isOpen, onClose, name, color }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string>(color || colorForName(name))
  const [error, setError] = useState<string | null>(null)

  function save(next: string | null) {
    setError(null)
    startTransition(async () => {
      const res = await setAvatarColor({ color: next })
      if (res && 'error' in res) {
        setError(res.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Warna chip">
      {/* Live preview */}
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={name} color={selected} size={56} />
        <span className="min-w-0 truncate text-lg uppercase tracking-wide text-[var(--tt-white)]">{name}</span>
      </div>

      {/* Recommended swatches */}
      <p className="mb-2 text-sm uppercase tracking-[0.1em] text-[var(--text-secondary)]">Rekomendasi</p>
      <div className="mb-5 flex flex-wrap gap-2.5">
        {CHIP_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelected(c)}
            aria-label={`Warna ${c}`}
            aria-pressed={selected.toLowerCase() === c}
            className={'h-11 w-11 border-2 transition-colors ' + (selected.toLowerCase() === c ? 'border-[var(--tt-white)]' : 'border-transparent hover:border-[var(--tt-rule-strong)]')}
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Custom colour: native picker + hex input */}
      <p className="mb-2 text-sm uppercase tracking-[0.1em] text-[var(--text-secondary)]">Custom</p>
      <div className="mb-5 flex items-center gap-3">
        <input
          type="color"
          aria-label="Pilih warna custom"
          value={HEX.test(selected) ? selected : '#00d0d0'}
          onChange={(e) => setSelected(e.target.value)}
          className="h-11 w-14 cursor-pointer border border-[var(--tt-rule-strong)] bg-transparent p-0"
        />
        <input
          type="text"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          placeholder="#00d0d0"
          maxLength={7}
          spellCheck={false}
          className="w-32 border border-[var(--tt-rule-strong)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base uppercase tracking-widest text-[var(--tt-cyan)] outline-none focus:border-[var(--tt-cyan)]"
        />
      </div>

      {error && <p className="mb-3 text-base uppercase tracking-wide text-[var(--tt-red)]">{error}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" fullWidth disabled={isPending} onClick={() => save(null)}>
          Reset
        </Button>
        <Button
          fullWidth
          disabled={isPending || !HEX.test(selected)}
          onClick={() => save(selected)}
          className="bg-[var(--tt-yellow)] text-black hover:bg-[color-mix(in_srgb,var(--tt-yellow)_86%,#000)]"
        >
          {isPending ? '...' : 'Simpan'}
        </Button>
      </div>
    </Sheet>
  )
}
