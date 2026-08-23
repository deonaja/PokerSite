import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { VT323 } from 'next/font/google'
import './globals.css'

// Teletext bitmap face — self-hosted by next/font. Placeholder for the truer
// broadcast face (e.g. Bedstead); VT323 carries the same chunky broadcast
// character at legible, touch-scaled sizes. Bound to --font-tt (body voice)
// and reused as the tabular numeric face via --font-mono.
const teletext = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-tt',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Poker Chip Tracker',
  description: 'Tracker chip & saldo buat sesi poker grup — dealer, rebuy, season, leaderboard.',
  applicationName: 'PokerAja',
  appleWebApp: {
    capable: true,
    title: 'PokerAja',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
}

// Direction contract (Impeccable, seed 2c95db6f). Emitted as a real HTML comment
// in the served markup so it survives the production build and is greppable by
// seed key. The source block above the export is the editor-facing copy.
//
// THESIS: PokerAja as a broadcast teletext results service; refuses the casino-felt
//   poker dashboard and the generic dark SaaS grid.
// OWN-WORLD: broadcast-8 on flat black — yellow double-height headers, cyan live
//   figures, green REVEAL, red alerts, magenta ranks; VT323 bitmap face; block-mosaic
//   chip stacks; square cells, 1px dim rules; touch-scaled so tap targets are >=44px.
// STORY: a player opens mid-game, reads the standings page like a score service,
//   sees who's live, keys to the session, settles up — trusted numbers, dim-legible.
// FIRST VIEWPORT: status bar (POKERAJA / P100 / clock); page tabs SALDO/SESI/RIWAYAT;
//   yellow PAPAN SALDO + season line; ranked rows (rank, block-mosaic, name, cyan
//   balance); active-session alert; sticky yellow MULAI SESI.
// FORM: Teletext service (bolder round, seed 2c95db6f, reroll 1); #1 by deal order,
//   chosen over felt-green after the mobile mitigation review.
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
//   review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
const DIRECTION_CONTRACT =
  '<!-- IMPECCABLE DIRECTION seed=2c95db6f world=teletext mode=operate ' +
  'THESIS: PokerAja as a broadcast teletext results service, refusing casino-felt and generic dark-SaaS. ' +
  'OWN-WORLD: broadcast-8 on flat black; yellow double-height headers, cyan live figures, green REVEAL, red alerts, magenta ranks; VT323 bitmap face; block-mosaic chip stacks; square cells, 1px rules; touch-scaled >=44px. ' +
  'STORY: read standings like a score service, see who is live, key to the session, settle up; trusted, dim-legible numbers. ' +
  'FIRST VIEWPORT: status bar POKERAJA/P100/clock; tabs SALDO/SESI/RIWAYAT; yellow PAPAN SALDO + season line; ranked rows; active-session alert; sticky yellow MULAI SESI. ' +
  'FORM: teletext service, bolder round reroll 1, #1 by deal, chosen over felt-green after mobile mitigation review. ' +
  'FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. -->'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`dark ${GeistSans.variable} ${teletext.variable}`}>
      <body>
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <div className="mx-auto max-w-[480px] min-h-dvh">
          {children}
        </div>
      </body>
    </html>
  )
}
