# Instruksi untuk Claude Code

Lo (Claude Code) bakal bangun aplikasi ini dari nol berdasarkan `SPEC.md`. Ikuti spec letter for letter.

## Aturan eksekusi

1. **Baca `SPEC.md` dulu sampai habis.** Jangan asumsi apapun di luar spec.
2. **MVP scope = M1 only.** Section "Roadmap & future architecture" (M2/M3/M4) di SPEC.md adalah informational — JANGAN diimplementasi. Tapi keputusan schema/teknis di MVP harus aware bahwa fitur itu akan datang (lihat "Implikasi ke MVP" di SPEC.md). Contoh konkret:
   - `edit_log.action` jangan pake CHECK constraint (validasi di app layer).
   - Jangan rename/restructure kolom yang nanti dipake M2.
3. **Tanya owner kalau ada ambiguitas yang ga ke-cover spec.** Jangan improvise.
4. **Mobile-first, dark mode only.** Spec aesthetic ada di SPEC.md bagian "Aesthetic direction". **Update (2026-05-29):** larangan shadcn/ui DICABUT oleh owner. shadcn boleh dipake sebagai **primitive (basis Radix UI)**, TAPI wajib di-tema ke palet felt-green existing (lihat token mapping di SPEC.md "Aesthetic direction") — jangan ship default shadcn (zinc/slate + primary biru + radius/shadow default) karena itu yang bikin "AI-ish". Identitas felt-green underground harus dipertahankan.
5. **Stack:** Next.js 15 App Router, TypeScript, Tailwind, `@vercel/postgres`, `pnpm`. Jangan tambah library lain tanpa konfirmasi.
6. **Ikuti file structure** yang udah dispesifik di SPEC.md bagian "Routes & file structure".
7. **Test mental tiap server action:** "kalau 2 device klik bareng, apa yang terjadi?" — pake DB transaction.
8. **Commit per fitur** dengan pesan jelas (conventional commits). Contoh: `feat: setup nextjs + tailwind`, `feat: db schema & migration`, `feat: identity picker`, `feat: dashboard pemain`, dst.

## Cara kerja per fase

Build incremental. Setelah selesai TIAP item di "Cara setup awal" di bawah:

- **Stop.**
- **Report ke owner:** file apa yang dibuat/diubah, summary singkat (1-3 kalimat), dan apa yang harus owner verify manual sebelum lanjut.
- **Tunggu owner approve** sebelum lanjut item berikutnya.

Jangan kerjain 10 step sekaligus dalam 1 turn — owner mau review per checkpoint. Kalau ada item yang trivial banget (misal install 1 dep tambahan), boleh digabung dengan item adjacent, tapi tetep report sebelum lanjut yang besar.

## Quality bar tiap screen

Sebelum nyatakan screen "selesai", pastikan ada:

- **Loading state** — subtle pulse, jangan spinner gede.
- **Empty state** — text tertiary, 1 sentence, jangan ilustrasi.
- **Error state** — kalo server action gagal, user dapet feedback yang jelas (bukan silent fail atau crash).
- **Tap target** ≥ 44×44px untuk semua interactive element.
- **Tabular-nums** untuk semua angka (balance, stack, rebuy count).
- **Tested mental model** di viewport 375×667 (iPhone SE) — kalau ada element yang overflow, fix sebelum nyatakan selesai.

## Yang dilarang

- ~~Pake shadcn/ui~~ — **dicabut 2026-05-29.** shadcn boleh, sebagai primitive yang di-tema (lihat rule 4). Material UI / Chakra / library "all-in-one" lain TETAP dilarang. Magic UI / animasi flashy juga dilarang (lawan mood SPEC).
- Pake Prisma, Drizzle, atau ORM. Plain SQL aja via `@vercel/postgres`.
- Pake state management library (zustand, redux, jotai). React state cukup.
- Pake SWR/React Query/TanStack Query. Polling pake `useEffect` + `setInterval` sesuai spec.
- Bikin light mode toggle.
- Tambah fitur di luar spec (lihat "Hal-hal yang DITUNDA" di SPEC.md).
- Hapus log entry. Log harus append-only. Undo = mark `voided=true`, bukan delete.
- Bikin file monolitik (single page.tsx 500+ baris). Split komponen secara wajar ke `components/`.

## Yang harus dilakukan

- Jalanin `pnpm dev` dan tes manual semua flow di SPEC.md "Acceptance criteria".
- Pastikan endpoint `/admin?key=salah` return 404 betulan (pake `notFound()` dari `next/navigation`), bukan custom error message yang ngasih tau ada endpoint admin.
- **Test concurrency:** buka 2 tab dengan identitas berbeda, klik rebuy bareng untuk pemain yang sama. Balance pemain itu HARUS kepotong 200 total (2× rebuy = -200), bukan cuma -100. Kalau cuma -100, ada race condition — fix dengan `SELECT ... FOR UPDATE` di dalam transaction.
- Sebelum push final commit, pastikan `pnpm build` sukses tanpa warning TypeScript.
- Pastikan partial unique index `one_active_session` enforce di DB level (test: coba insert 2 sesi active manual via psql, harus error).

## Cara setup awal (suggested order, satu-satu)

1. **Scaffold Next.js + deps.** `pnpm init`, install: `next@15`, `react`, `react-dom`, `typescript`, `@types/*`, `tailwindcss`, `postcss`, `autoprefixer`, `@vercel/postgres`, `geist`. Setup `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`.
2. **Tailwind + global CSS.** `app/globals.css` dengan CSS variables persis dari SPEC.md "Color palette". Root layout dengan dark mode (`<html class="dark">`), font binding (Geist Sans + JetBrains Mono via `next/font`), viewport meta, base body styling, max-width container 480px.
3. **DB schema & migration.** `db/migrations/001_init.sql` (copy dari SPEC.md, verbatim). `db/migrate.ts` runner. `package.json` script `db:migrate`. Test: jalanin migrasi ke DATABASE_URL real, verify schema di DB.
4. **DB lib + types.** `lib/db.ts` (export `sql` dari `@vercel/postgres`), `lib/types.ts` (Player, Session, SessionParticipant, EditLog, etc).
5. **Identity flow.** `/identity` page (list pemain, tap → save localStorage), `(main)/layout.tsx` client check + redirect ke `/identity` kalau kosong, header dengan "Hi, [Nama]" + "ganti identitas" button.
6. **Dashboard.** `/` page — list pemain + balance, card "sesi aktif" kalau ada, sticky CTA "Mulai sesi". Server component untuk fetch awal.
7. **Session setup.** `/session/setup` — checkbox pemain, radio dealer (cuma muncul untuk pemain yang dicentang), validasi min 2 pemain. Server action `startSession` dengan transaction.
8. **Session active.** `/session` — list peserta dengan dealer badge + rebuy count, tombol Rebuy/Undo per pemain, bottom sheet konfirmasi, sticky "End" button di header. Server actions `rebuy`, `undoRebuy` dengan `SELECT FOR UPDATE`.
9. **End session multi-step.** `/session/end` — 1 pemain per screen, "Next" button, recap screen dengan validasi total chip + warning kalau selisih, Confirm → apply balance updates dalam 1 transaction.
10. **Admin endpoint.** `/admin?key=xxx` — key check via env var, `notFound()` kalau salah. Sub-fitur: tambah pemain, edit balance manual (wajib alasan), force-end sesi, view log paginated dengan filter.
11. **Polling.** `/api/poll` route returning `{ players, activeSession }`. Client hook di halaman yang butuh (`/`, `/session`) — `useEffect` + `setInterval(2000)`, compare JSON.stringify, re-render kalau berubah.
12. **Polish pass.** Bottom sheet primitive (`components/Sheet.tsx`), transitions 150-200ms, loading/empty/error states di tiap screen, env.example update, README usage notes.

Tiap step di atas = 1 checkpoint. Jangan skip checkpoint.

Tanya owner kalau ada blocker. Jangan stuck diem.