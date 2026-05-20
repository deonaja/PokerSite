# Poker Chip Tracker

Web app buat tracking chip & balance pemain poker Texas Hold'em rumahan. Mobile-first, dark mode, shared state antar device.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Database:** Vercel Postgres (Neon)
- **Deploy:** Vercel
- **Sync:** Polling 2 detik (no websocket)

## Quick start

```bash
pnpm install
cp .env.example .env.local   # isi DATABASE_URL & ADMIN_KEY
pnpm db:migrate              # bikin tabel
pnpm dev
```

## Deploy

1. Push ke GitHub.
2. Import repo di Vercel.
3. Connect Vercel Postgres (dari dashboard).
4. Set env var `ADMIN_KEY` di project settings.
5. Run `pnpm db:migrate` lokal dengan production DATABASE_URL untuk init schema.

## Spec

Lihat `SPEC.md` untuk requirement lengkap. Implementasi mengikuti spec tersebut secara letter.

## Admin

Akses `/admin?key=<ADMIN_KEY>` untuk CRUD pemain & edit balance manual. URL & key disimpan privat — jangan dishare ke pemain biasa.
