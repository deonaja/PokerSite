// Achievement icons — teletext block-mosaic glyphs (7x7), one per category, drawn
// as crisp SVG rects in the tier colour. This replaced the earlier smooth-line
// SVG artwork so achievements read in the same pixel language as the rest of the
// app. Tier drives colour, not shape:
//   0 (locked) → dark   ·   1 → silver   ·   2 → cyan   ·   3 → gold + glow

export type AchievementCategoryId =
  | 'bandar'
  | 'juara'
  | 'podium'
  | 'veteran'
  | 'sultan'
  | 'untung'

interface Props {
  categoryId: AchievementCategoryId | string
  tier: 0 | 1 | 2 | 3 // 0 = locked
  size?: number
  className?: string
}

// Row-major 7x7, 1 = lit.
const GLYPHS: Record<string, number[]> = {
  bandar:  [0,1,1,1,1,1,0, 0,0,0,0,0,0,0, 0,1,1,1,1,1,0, 0,0,0,0,0,0,0, 0,1,1,1,1,1,0, 0,0,0,0,0,0,0, 1,1,1,1,1,1,1],
  juara:   [1,1,1,1,1,1,1, 1,1,1,1,1,1,1, 0,1,1,1,1,1,0, 0,0,1,1,1,0,0, 0,0,0,1,0,0,0, 0,0,1,1,1,0,0, 0,1,1,1,1,1,0],
  podium:  [0,0,0,0,0,0,0, 0,0,1,1,1,0,0, 0,0,1,1,1,0,0, 1,1,1,1,1,0,1, 1,1,1,1,1,0,1, 1,1,1,1,1,1,1, 1,1,1,1,1,1,1],
  veteran: [0,0,1,1,1,0,0, 0,1,0,0,0,1,0, 1,0,0,1,0,0,1, 1,0,0,1,1,0,1, 1,0,0,0,0,0,1, 0,1,0,0,0,1,0, 0,0,1,1,1,0,0],
  sultan:  [1,0,0,1,0,0,1, 1,0,1,1,1,0,1, 1,1,1,1,1,1,1, 1,1,1,1,1,1,1, 0,1,1,1,1,1,0, 0,1,1,1,1,1,0, 0,0,0,0,0,0,0],
  untung:  [0,0,0,0,0,0,1, 0,0,0,0,0,1,1, 0,0,0,0,1,1,1, 0,0,0,1,1,1,1, 0,0,1,1,1,1,1, 0,1,1,1,1,1,1, 1,1,1,1,1,1,1],
}

const TIER_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: '#262626', // locked
  1: '#9aa0a0', // silver
  2: '#00d0d0', // cyan
  3: '#ffe800', // gold
}

export function AchievementIcon({ categoryId, tier, size = 48, className }: Props) {
  const bits = GLYPHS[categoryId]
  if (!bits) return null
  const color = TIER_COLOR[tier]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      fill={color}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${categoryId} tier ${tier}`}
      className={className}
      style={tier === 3 ? { filter: 'drop-shadow(0 0 3px rgba(255,232,0,0.55))' } : undefined}
    >
      {bits.map((v, i) =>
        v ? <rect key={i} x={i % 7} y={Math.floor(i / 7)} width={1} height={1} /> : null
      )}
    </svg>
  )
}
