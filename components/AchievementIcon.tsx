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

// 12x12 detailed glyphs, row-major strings (1 = lit).
const GLYPH_ROWS: Record<string, string[]> = {
  bandar:  ['000011110000','000111111000','011111111110','011100001110','111000000111','111001100111','111001100111','111000000111','011100001110','011111111110','000111111000','000011110000'],
  juara:   ['011111111110','011111111110','011111111110','111111111111','001111111100','000111111000','000011110000','000011110000','000011110000','000111111000','001111111100','011111111110'],
  podium:  ['000001100000','000011110000','000011110000','000011110000','110011110000','110011110011','110011110011','111111111111','111011110111','111011110111','111011110111','111111111111'],
  veteran: ['001100001100','001100001100','000111111000','011111111110','111100001111','111011110111','111011110111','111100001111','011111111110','001111111100','000111111000','000011110000'],
  sultan:  ['100000000001','110000000011','101000000101','101100001101','100110011001','100011110001','111111111111','111111111111','011111111110','011111111110','001111111100','000000000000'],
  untung:  ['000000000011','000000000111','000000011110','000000111100','000011110000','000111100000','011110000000','111100000000','110000000000','000000000000','110110110110','111111111111'],
}

const GLYPHS: Record<string, number[]> = Object.fromEntries(
  Object.entries(GLYPH_ROWS).map(([k, rows]) => [k, rows.join('').split('').map(Number)])
)

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
      viewBox="0 0 12 12"
      fill={color}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${categoryId} tier ${tier}`}
      className={className}
      style={tier === 3 ? { filter: 'drop-shadow(0 0 3px rgba(255,232,0,0.55))' } : undefined}
    >
      {bits.map((v, i) =>
        v ? <rect key={i} x={i % 12} y={Math.floor(i / 12)} width={1} height={1} /> : null
      )}
    </svg>
  )
}
