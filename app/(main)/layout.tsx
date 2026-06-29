import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { getAuthenticatedPlayer } from '@/lib/auth-server'
import LocalStorageSync from '@/components/LocalStorageSync'
import HeaderMenu from '@/components/HeaderMenu'
import WelcomeGuide from '@/components/WelcomeGuide'
import PushToast from '@/components/PushToast'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [activeSeason, authPlayer] = await Promise.all([
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    getAuthenticatedPlayer(),
  ])
  if (activeSeason.length === 0) redirect('/season/new')
  if (!authPlayer) redirect('/identity')

  return (
    <div className="flex min-h-dvh flex-col">
      <HeaderMenu name={authPlayer.name} />
      <WelcomeGuide />
      <PushToast />

      <main className="flex-1">
        <LocalStorageSync playerId={authPlayer.id} playerName={authPlayer.name} />
        {children}
      </main>
    </div>
  )
}
