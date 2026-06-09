// One-off generator for PWA / favicon icons. Renders a felt-green poker-chip
// emblem (with a spade) to PNGs via sharp. Re-run with `node scripts/gen-icons.mjs`
// if the artwork changes. Outputs:
//   app/icon.png            (512, favicon — Next auto-links)
//   app/apple-icon.png      (180, apple-touch — Next auto-links)
//   public/icon-192.png     (manifest, purpose any)
//   public/icon-512.png     (manifest, purpose any)
//   public/icon-maskable-512.png (manifest, purpose maskable — full-bleed felt)
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require(join(process.cwd(), 'node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'))

// palette (mirrors app/globals.css)
const BG = '#0a0a0a'
const FELT = '#1d6b4f'
const FELT_DEEP = '#15493a'
const CREAM = '#e8e8e6'

// Classic spade outline (24×24 space), drawn cream over the chip face.
const SPADE =
  'M12,2 C9,6 3,9 3,14 C3,16.5 5,18.5 7.5,18.5 C8.8,18.5 10,17.9 10.8,17 ' +
  'C10.5,19 9.5,20.5 8,21.5 L16,21.5 C14.5,20.5 13.5,19 13.2,17 ' +
  'C14,17.9 15.2,18.5 16.5,18.5 C19,18.5 21,16.5 21,14 C21,9 15,6 12,2 Z'

// Eight edge spots around the chip rim.
function edgeSpots(cx, cy, r) {
  let out = ''
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    out += `<rect x="${x - 16}" y="${y - 26}" width="32" height="52" rx="14" fill="${CREAM}" transform="rotate(${i * 45} ${x} ${y})"/>`
  }
  return out
}

// chipScale: chip radius as a fraction of half the canvas (smaller for maskable
// so the emblem stays inside the platform safe zone). bg: 'rounded' | 'full'.
function svg({ chipScale = 0.92, bg = 'rounded' } = {}) {
  const S = 512
  const c = S / 2
  const R = c * chipScale // outer chip radius
  const ring = R * 0.86 // inner cream ring
  const face = R * 0.78 // felt face
  const spadeH = face * 1.05 // spade target height
  const k = spadeH / 19.5 // spade path is ~19.5 tall
  const tx = c - 12 * k
  const ty = c - 11.75 * k
  const background =
    bg === 'full'
      ? `<rect width="${S}" height="${S}" fill="${FELT_DEEP}"/>`
      : `<rect width="${S}" height="${S}" rx="${S * 0.22}" fill="${BG}"/>`
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    ${background}
    <circle cx="${c}" cy="${c}" r="${R}" fill="${CREAM}"/>
    ${edgeSpots(c, c, R)}
    <circle cx="${c}" cy="${c}" r="${ring}" fill="${FELT}"/>
    <circle cx="${c}" cy="${c}" r="${face}" fill="none" stroke="${CREAM}" stroke-width="${R * 0.05}"/>
    <g transform="translate(${tx} ${ty}) scale(${k})"><path d="${SPADE}" fill="${CREAM}"/></g>
  </svg>`)
}

const out = [
  { file: 'app/icon.png', size: 512, opts: { bg: 'rounded', chipScale: 0.92 } },
  { file: 'app/apple-icon.png', size: 180, opts: { bg: 'rounded', chipScale: 0.92 } },
  { file: 'public/icon-192.png', size: 192, opts: { bg: 'rounded', chipScale: 0.92 } },
  { file: 'public/icon-512.png', size: 512, opts: { bg: 'rounded', chipScale: 0.92 } },
  { file: 'public/icon-maskable-512.png', size: 512, opts: { bg: 'full', chipScale: 0.7 } },
]

for (const { file, size, opts } of out) {
  const abs = join(process.cwd(), file)
  mkdirSync(dirname(abs), { recursive: true })
  const png = await sharp(svg(opts), { density: 384 }).resize(size, size).png().toBuffer()
  writeFileSync(abs, png)
  console.log(`wrote ${file} (${size}×${size}, ${png.length} bytes)`)
}
console.log('done')
