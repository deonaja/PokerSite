// Teletext block-mosaic icons. Each glyph is a 5x5 pixel grid drawn as crisp SVG
// rects in currentColor, so it inherits the surrounding text colour (usually
// cyan). Icons always sit next to a text label — they add teletext identity, the
// label carries the meaning — so a slightly abstract glyph is fine.
export type PixelIconName =
  | 'chip' | 'person' | 'clock' | 'cards' | 'flag' | 'people'
  | 'calendar' | 'trophy' | 'bell' | 'star' | 'shield' | 'plus'

// Row-major 5x5, 1 = lit.
const GLYPHS: Record<PixelIconName, number[]> = {
  chip:     [1,1,1,1,1, 0,0,0,0,0, 1,1,1,1,1, 0,0,0,0,0, 1,1,1,1,1],
  person:   [0,0,1,0,0, 0,1,1,1,0, 0,0,1,0,0, 0,1,1,1,0, 1,1,1,1,1],
  clock:    [0,1,1,1,0, 1,0,0,1,1, 1,0,1,0,1, 1,0,0,0,1, 0,1,1,1,0],
  cards:    [1,1,1,1,1, 1,0,0,0,1, 1,0,1,0,1, 1,0,0,0,1, 1,1,1,1,1],
  flag:     [1,1,1,1,0, 1,1,0,1,0, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0],
  people:   [0,1,0,1,0, 1,1,1,1,1, 0,0,0,0,0, 0,1,0,1,0, 1,1,1,1,1],
  calendar: [1,1,1,1,1, 1,0,1,0,1, 1,1,1,1,1, 1,0,1,0,1, 1,0,1,0,1],
  trophy:   [1,1,1,1,1, 1,1,1,1,1, 0,1,1,1,0, 0,0,1,0,0, 0,1,1,1,0],
  bell:     [0,0,1,0,0, 0,1,1,1,0, 0,1,1,1,0, 1,1,1,1,1, 0,0,1,0,0],
  star:     [0,0,1,0,0, 0,1,1,1,0, 1,1,1,1,1, 0,1,1,1,0, 1,0,1,0,1],
  shield:   [1,1,1,1,1, 1,1,1,1,1, 1,1,1,1,1, 0,1,1,1,0, 0,0,1,0,0],
  plus:     [0,0,1,0,0, 0,0,1,0,0, 1,1,1,1,1, 0,0,1,0,0, 0,0,1,0,0],
}

interface Props {
  name: PixelIconName
  size?: number
  className?: string
}

export default function PixelIcon({ name, size = 18, className }: Props) {
  const bits = GLYPHS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      fill="currentColor"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden
      role="presentation"
    >
      {bits.map((v, i) =>
        v ? <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1} height={1} /> : null
      )}
    </svg>
  )
}
