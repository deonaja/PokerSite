// Player avatar — a pixel-art poker chip. Blocky ring + white edge spots + the
// player's initial in the teletext face. Colour is derived deterministically from
// the name (broadcast-8 palette) so every player reads as a distinct chip.
// Pure render, no hooks → safe in server and client components.

const CHIP_COLORS = ['#00d0d0', '#ffe800', '#e850c0', '#00c000', '#ff8c1a', '#ff3b30'] as const

function colorFor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CHIP_COLORS[h % CHIP_COLORS.length]
}

// 11x11: R = ring (player colour), F = dark fill, S = white edge spot, . = empty.
const MASK = [
  '...RRSRR...',
  '..RFFFFFR..',
  '.RFSFFFSFR.',
  'RFFFFFFFFFR',
  'RFFFFFFFFFR',
  'SFFFFFFFFFS',
  'RFFFFFFFFFR',
  'RFFFFFFFFFR',
  '.RFSFFFSFR.',
  '..RFFFFFR..',
  '...RRSRR...',
]

// Precompute the pixel list once; colour is applied per-render.
const PIXELS: { x: number; y: number; t: 'R' | 'F' | 'S' }[] = []
MASK.forEach((row, y) =>
  row.split('').forEach((ch, x) => {
    if (ch === 'R' || ch === 'F' || ch === 'S') PIXELS.push({ x, y, t: ch })
  })
)

interface Props {
  name: string
  size?: number
  className?: string
}

export default function Avatar({ name, size = 36, className }: Props) {
  const color = colorFor(name)
  const initial = (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()
  return (
    <span
      className={'relative inline-block shrink-0 leading-none' + (className ? ' ' + className : '')}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 11 11" shapeRendering="crispEdges">
        {PIXELS.map(({ x, y, t }) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={t === 'R' ? color : t === 'S' ? '#eaeaea' : '#0a0a0a'}
          />
        ))}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono uppercase"
        style={{ color, fontSize: Math.round(size * 0.42) }}
      >
        {initial}
      </span>
    </span>
  )
}
