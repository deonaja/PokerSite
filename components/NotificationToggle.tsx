'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff } from 'lucide-react'
import Button from './Button'
import { Card } from './ui/card'
import { savePushSubscription, deletePushSubscription, sendTestPush } from '@/lib/actions/push'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

// Convert the base64url VAPID public key to the Uint8Array the Push API wants.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type State = 'loading' | 'unsupported' | 'off' | 'on'

export default function NotificationToggle() {
  const [state, setState] = useState<State>('loading')
  const [denied, setDenied] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iphone|ipad|ipod/i.test(ua))

    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported || !VAPID_PUBLIC_KEY) {
      setState('unsupported')
      return
    }
    setDenied(Notification.permission === 'denied')

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [])

  async function enable() {
    setError(null)
    setMsg(null)
    if (Notification.permission === 'denied') {
      setDenied(true)
      setError('Izin notifikasi diblokir. Aktifkan lewat pengaturan browser dulu.')
      return
    }
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setDenied(perm === 'denied')
        setError('Izin notifikasi belum diberikan.')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      startTransition(async () => {
        const res = await savePushSubscription({
          endpoint: json.endpoint ?? sub.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          userAgent: navigator.userAgent,
        })
        if ('error' in res) {
          setError(res.error)
          await sub.unsubscribe().catch(() => {})
        } else {
          setState('on')
          setMsg('Notifikasi aktif untuk perangkat ini.')
        }
      })
    } catch (e) {
      console.error('enable push failed', e)
      setError('Gagal mengaktifkan notifikasi.')
    }
  }

  async function disable() {
    setError(null)
    setMsg(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      const endpoint = sub?.endpoint
      await sub?.unsubscribe().catch(() => {})
      startTransition(async () => {
        if (endpoint) await deletePushSubscription({ endpoint })
        setState('off')
        setMsg('Notifikasi dimatikan untuk perangkat ini.')
      })
    } catch (e) {
      console.error('disable push failed', e)
      setError('Gagal mematikan notifikasi.')
    }
  }

  function test() {
    setError(null)
    setMsg(null)
    startTransition(async () => {
      const res = await sendTestPush()
      if ('error' in res) setError(res.error)
      else setMsg('Notif tes dikirim — cek perangkat kamu.')
    })
  }

  if (state === 'loading') {
    return <div className="h-28 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
  }

  if (state === 'unsupported') {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <BellOff className="size-4 text-muted-foreground" />
          Notifikasi belum didukung di sini
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          {isIOS
            ? 'Di iPhone, notifikasi cuma jalan kalau app sudah ditambahkan ke layar utama (Bagikan → Tambahkan ke Layar Utama), lalu buka dari ikon itu.'
            : 'Browser ini tidak mendukung push notification, atau kunci notifikasi belum diset di server.'}
        </p>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Notifikasi pinjaman</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Dapat notif di HP saat ada permintaan pinjaman, disetujui, atau dilunasi —
            walau app sedang tertutup.
          </p>
        </div>
      </div>

      {denied && (
        <p className="text-[0.8125rem] text-destructive">
          Izin notifikasi diblokir di browser. Aktifkan dulu lewat pengaturan situs.
        </p>
      )}
      {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}
      {msg && <p className="text-[0.8125rem] text-primary">{msg}</p>}

      {state === 'on' ? (
        <div className="flex flex-col gap-2">
          <Button type="button" fullWidth onClick={test} disabled={isPending}>
            {isPending ? 'Mengirim…' : 'Kirim notif tes'}
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={disable} disabled={isPending}>
            Matikan notifikasi
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          fullWidth
          className="h-12 text-base font-semibold uppercase tracking-wide"
          onClick={enable}
          disabled={isPending}
        >
          {isPending ? 'Mengaktifkan…' : 'Aktifkan notifikasi'}
        </Button>
      )}
    </Card>
  )
}
