# 🃏 Poker Chip Tracker

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)
![Postgres](https://img.shields.io/badge/Neon-Postgres-336791?logo=postgresql&logoColor=white)

Web app buat tracking chip & balance pemain poker Texas Hold'em rumahan.
Mobile-first, dark mode, shared state antar device via polling — semua pemain
liat balance & sesi yang sama secara real-time tanpa websocket.

> **Live:** [pokeraja.vercel.app](https://pokeraja.vercel.app) — instance pribadi (login butuh PIN pemain terdaftar).

## ✨ Fitur

- **Identitas + PIN** — tiap pemain login pakai PIN (sesi cookie 7 hari), dengan throttle anti brute-force.
- **Sistem musim (season)** — buy-in, blind, pool, jumlah sesi, preset; fase bootstrap → steady otomatis.
- **Sesi aktif** — rebuy / undo per pemain, badge dealer, sinkron 2 detik antar device (race-safe pakai `SELECT ... FOR UPDATE`).
- **End-session wizard** — input stack akhir per pemain → recap → konfirmasi → balance ter-update dalam 1 transaksi.
- **Akhir musim & leaderboard** — snapshot hasil, ranking, statistik per pemain, achievement.
- **Panel admin** — tambah pemain, edit balance (wajib alasan), reset PIN, force-end, export CSV, log append-only.

## 🛠️ Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/Radix primitives
- **Database:** Neon PostgreSQL (`@neondatabase/serverless` + `@vercel/postgres`) — plain SQL, tanpa ORM
- **Sync:** polling 2 detik via `/api/poll` (cached di edge)
- **Deploy:** Vercel

## 🚀 Quick start

```bash
pnpm install
cp .env.example .env.local   # isi DATABASE_URL, POSTGRES_URL, ADMIN_KEY
pnpm db:migrate              # buat semua tabel
pnpm dev                     # http://localhost:3000
```

`DATABASE_URL` & `POSTGRES_URL` diisi connection string yang sama (Neon).
Generate `ADMIN_KEY`: `openssl rand -hex 16`.

## 🧪 Test

```bash
pnpm test           # Playwright e2e (mobile viewport)
```

Test butuh DB. Biar nggak ngotorin DB dev, set `TEST_DATABASE_URL` di
`.env.local` ke sebuah Neon branch — suite otomatis pakai itu. Lihat
[CONTRIBUTING.md](CONTRIBUTING.md).

## ☁️ Deploy ke Vercel

1. Push ke GitHub, import repo di [vercel.com](https://vercel.com) (preset Next.js auto-detect).
2. Tab **Storage** → connect **Neon** → otomatis inject `DATABASE_URL` + `POSTGRES_URL`.
3. Tambah env `ADMIN_KEY` manual.
4. Jalanin `pnpm db:migrate` ke connection string prod buat init schema.
5. Deploy. Tiap push ke `main` auto-deploy.

## 🔐 Admin

Akses `/admin?key=<ADMIN_KEY>` buat manajemen pemain, edit balance, reset PIN,
force-end sesi, export CSV, dan view log. URL ini **return 404 kalau key salah**
— jangan share ke pemain biasa.

## 🛡️ Keamanan

Setiap server action mengotorisasi dirinya sendiri (admin / login), PIN di-hash
scrypt, brute-force di-throttle. Lapor celah keamanan via
[SECURITY.md](SECURITY.md) — **jangan** buka issue publik.

## 🤝 Kontribusi

Lihat [CONTRIBUTING.md](CONTRIBUTING.md). Spec lengkap ada di [`SPEC.md`](SPEC.md).

## 📄 Lisensi

[MIT](LICENSE) © deonaja

<!-- test: direct push ke main (branch protection check) -->
