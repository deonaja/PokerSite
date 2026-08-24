import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NotificationToggle from '@/components/NotificationToggle'
import { isAdmin } from '@/lib/auth-server'

export default async function NotificationsSettingsPage() {
  const admin = await isAdmin()
  return (
    <div className="flex flex-col gap-6 px-4 pt-12 pb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Kembali"
          className="flex min-h-11 min-w-11 items-center text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
          <span className="text-[var(--tt-magenta)]">P600</span> Notifikasi
        </h1>
      </div>

      <NotificationToggle showTestButton={admin} />

      <p className="text-[0.8125rem] text-muted-foreground">
        Aktifkan per perangkat. Notif dikirim ke semua perangkat yang sudah kamu aktifkan.
      </p>
    </div>
  )
}
