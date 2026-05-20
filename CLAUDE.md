# Instruksi untuk Claude Code

Lo (Claude Code) bakal bangun aplikasi ini dari nol berdasarkan `SPEC.md`. Ikuti spec letter for letter.

## Aturan eksekusi

1. **Baca `SPEC.md` dulu sampai habis.** Jangan asumsi apapun di luar spec.
2. **Tanya owner kalau ada ambiguitas yang ga ke-cover spec.** Jangan improvise.
3. **Mobile-first, dark mode only.** Spec aesthetic ada di SPEC.md bagian "Aesthetic direction". Jangan pake shadcn/ui — bikin component custom.
4. **Stack:** Next.js 15 App Router, TypeScript, Tailwind, `@vercel/postgres`, `pnpm`. Jangan tambah library lain tanpa konfirmasi.
5. **Ikuti file structure** yang udah dispesifik di SPEC.md bagian "Routes & file structure".
6. **Test mental tiap server action:** "kalau 2 device klik bareng, apa yang terjadi?" — pake DB transaction.
7. **Commit per fitur** dengan pesan jelas. Contoh: `feat: setup nextjs + tailwind`, `feat: db schema & migration`, `feat: identity picker`, `feat: dashboard pemain`, dst.

## Yang dilarang

- Pake shadcn/ui, Material UI, atau component library lain.
- Pake Prisma, Drizzle, atau ORM. Plain SQL aja via `@vercel/postgres`.
- Pake state management library (zustand, redux, jotai). React state cukup.
- Bikin light mode toggle.
- Tambah fitur di luar spec (lihat "Hal-hal yang DITUNDA" di SPEC.md).
- Hapus log entry. Log harus append-only. Undo = mark `voided=true`, bukan delete.

## Yang harus dilakukan

- Jalanin `pnpm dev` dan tes manual semua flow di SPEC.md "Acceptance criteria".
- Pastikan endpoint `/admin?key=salah` return 404 betulan (pake `notFound()` dari `next/navigation`), bukan custom error.
- Test concurrency: buka 2 tab, klik rebuy bareng untuk pemain yang sama. Balance HARUS kepotong 200 (bukan cuma 100 karena race).
- Sebelum push final commit, pastikan `pnpm build` sukses.

## Cara setup awal (suggested order)

1. `pnpm init` + install deps (next, react, typescript, tailwind, @vercel/postgres, geist).
2. Setup Tailwind + global CSS dengan CSS vars dari SPEC.md.
3. Bikin `db/migrations/001_init.sql` + script `db/migrate.ts`.
4. Bikin `lib/db.ts` + `lib/types.ts`.
5. Bikin layout & identity picker dulu (yang paling dasar).
6. Dashboard.
7. Session setup → active → end flow.
8. Admin endpoint.
9. Polling `/api/poll`.
10. Polish: bottom sheet, transitions, empty states.

Tanya owner kalau ada blocker. Jangan stuck diem.
