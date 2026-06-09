import type { MetadataRoute } from 'next'

// PWA manifest — makes the app installable ("Add to Home Screen") and run
// full-screen/standalone, which is the primary way it's used (phones at the
// table). Colors mirror the felt-green palette in app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Poker Chip Tracker',
    short_name: 'PokerAja',
    description: 'Tracker chip & saldo buat sesi poker grup — dealer, rebuy, season, leaderboard.',
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    categories: ['games', 'finance', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
