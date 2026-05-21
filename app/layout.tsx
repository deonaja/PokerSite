import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Poker Chip Tracker',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`dark ${GeistSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="mx-auto max-w-[480px] min-h-dvh">
          {children}
        </div>
      </body>
    </html>
  )
}
