// Player avatar — a pixel-art poker chip. Blocky ring + white edge spots + the
// player's initial in the teletext face. Colour is the player's saved custom
// colour when set, otherwise derived deterministically from the name (broadcast-8
// palette). Pure render, no hooks → safe in server and client components.

export const CHIP_COLORS = ['#00d0d0', '#ffe800', '#e850c0', '#00c000', '#ff8c1a', '#ff3b30'] as const

export function colorForName(name: string): string {
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

const PIXELS: { x: number; y: number; t: 'R' | 'F' | 'S' }[] = []
MASK.forEach((row, y) =>
  row.split('').forEach((ch, x) => {
    if (ch === 'R' || ch === 'F' || ch === 'S') PIXELS.push({ x, y, t: ch })
  })
)

interface Props {
  name: string
  size?: number
  /** Saved custom colour; falls back to the name-derived colour when omitted. */
  color?: string | null
  className?: string
}

export default function Avatar({ name, size = 36, color, className }: Props) {
  const c = color || colorForName(name)
  const initial = (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 11 11"
      shapeRendering="crispEdges"
      className={'inline-block shrink-0 align-middle' + (className ? ' ' + className : '')}
      aria-hidden
    >
      {PIXELS.map(({ x, y, t }) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={t === 'R' ? c : t === 'S' ? '#eaeaea' : '#0a0a0a'}
        />
      ))}
      {/* Initial drawn as SVG text so it centres on the chip regardless of font
          metrics (an HTML overlay drifted with VT323's ascender space). */}
      <text
        x={5.5}
        y={5.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c}
        className="font-mono uppercase"
        style={{ fontSize: 4.7 }}
      >
        {initial}
      </text>
    </svg>
  )
}
