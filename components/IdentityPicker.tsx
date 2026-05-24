import type { Player } from '@/lib/types'

export default function IdentityPicker({ players }: { players: Player[] }) {
  return (
    <div className="flex flex-col px-4 pt-12 pb-8">
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Pilih nama kamu
      </p>

      {players.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Belum ada pemain terdaftar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <form key={p.id} method="post" action="/api/identity">
              <input type="hidden" name="playerId" value={p.id} />
              <input type="hidden" name="playerName" value={p.name} />
              <button
                type="submit"
                className="w-full text-left px-4 py-3 rounded-lg border transition-colors duration-150"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {p.name}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
