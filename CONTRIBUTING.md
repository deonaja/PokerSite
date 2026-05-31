# Kontribusi

Makasih udah mau kontribusi! Project ini app tracking chip poker rumahan —
mobile-first, dark mode, plain SQL. Spec lengkap & keputusan desain ada di
[`SPEC.md`](SPEC.md).

## Prasyarat

- **Node.js** 20+
- **pnpm** (project pakai `pnpm`, bukan npm/yarn)
- Database **PostgreSQL** (gampangnya: Neon free tier)

## Setup

```bash
git clone https://github.com/deonaja/PokerSite.git
cd poker-chip-tracker
pnpm install
cp .env.example .env.local      # isi DATABASE_URL, POSTGRES_URL, ADMIN_KEY
pnpm db:migrate                 # buat semua tabel
pnpm dev                        # http://localhost:3000
```

## Menjalankan test

```bash
pnpm test                       # Playwright e2e (viewport mobile)
```

Test butuh DB hidup. **Biar nggak ngotorin data dev**, set `TEST_DATABASE_URL`
di `.env.local` ke sebuah **Neon branch** — suite otomatis pakai connection itu
buat runner maupun dev server. Kalau kosong, test jatuh ke `DATABASE_URL`.

## Konvensi

- **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`, dst.
- **TypeScript strict** — `pnpm build` harus lolos tanpa error sebelum PR.
- **Plain SQL via `@vercel/postgres`** — jangan tambah ORM (Prisma/Drizzle).
- **Server action wajib otorisasi sendiri** — action ID ke-expose di client
  bundle, jadi cek admin/login di dalam action, bukan cuma di middleware.
- **Log append-only** — undo = `voided = true`, bukan DELETE.
- **Mobile-first, dark mode** — target viewport 375×667, tabular-nums buat angka,
  tap target ≥ 44px, ada loading/empty/error state tiap layar.

## Alur PR

1. Fork & bikin branch dari `main` (`feat/...`, `fix/...`).
2. Bikin perubahan + test; pastiin `pnpm build` & `pnpm test` hijau.
3. Buka Pull Request dengan deskripsi jelas (apa & kenapa).

Pertanyaan? Buka GitHub issue (kecuali soal keamanan — lihat [SECURITY.md](SECURITY.md)).
