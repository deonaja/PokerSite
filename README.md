# Poker Chip Tracker

Web app buat tracking chip & balance pemain poker Texas Hold'em rumahan. Mobile-first, dark mode only, shared state antar device via polling.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Database:** Neon PostgreSQL (via `@neondatabase/serverless` + `@vercel/postgres`)
- **Deploy:** Vercel
- **Sync:** Polling 2 detik via `/api/poll` — no websocket

## Quick start

```bash
pnpm install
cp .env.example .env.local   # isi DATABASE_URL, POSTGRES_URL, ADMIN_KEY
pnpm db:migrate              # buat semua tabel
pnpm dev                     # http://localhost:3000
```

`DATABASE_URL` dan `POSTGRES_URL` diisi dengan connection string yang sama (Neon direct connection).

## Deploy ke Vercel

1. Push ke GitHub.
2. Import repo di [vercel.com](https://vercel.com).
3. Tambah env vars di project settings: `DATABASE_URL`, `POSTGRES_URL`, `ADMIN_KEY`.
4. Jalanin `pnpm db:migrate` lokal dengan production `DATABASE_URL` untuk init schema di Neon.
5. Deploy.

## Admin

Akses `/admin?key=<ADMIN_KEY>` untuk:
- Tambah / lihat semua pemain
- Edit balance manual (wajib isi alasan)
- Force-end sesi aktif
- View edit log dengan filter per action type

URL ini return 404 kalau key salah — jangan share ke pemain biasa.

## Flow singkat

1. Buka app → pilih identitas kamu
2. Dashboard: lihat balance semua pemain, mulai sesi baru
3. Sesi aktif: rebuy per pemain, undo rebuy
4. End sesi: input stack akhir tiap pemain → recap → confirm → balance terupdate
