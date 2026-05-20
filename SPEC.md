# Poker Chip Tracker — Spec

Web app buat tracking balance & chip pemain poker Texas Hold'em rumahan. Owner main poker sama temen-temen, butuh papan tulis digital biar ga ribet nyatet manual. Mobile-first karena dipake di HP pas lagi main.

## Tech stack (wajib)

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- `@vercel/postgres` untuk DB
- React Server Components untuk data fetching, Server Actions untuk mutasi
- Polling 2 detik di client untuk sync (pake `useEffect` + `setInterval`, ga perlu SWR/React Query)
- Package manager: `pnpm`

Jangan pake: shadcn/ui (biar custom), Prisma (overkill), zustand/redux (state minimal), websocket.

## Aesthetic direction (wajib diikuti)

**Mood:** dark mode default, low-key felt-table green accent, sedikit underground/serius — bukan flashy casino, bukan generic SaaS.

**Typography:**
- UI text: Geist Sans (via `next/font`)
- Angka (balance, stack, chip count): JetBrains Mono (via `next/font`), tabular-nums
- Heading: Geist Sans medium 500 weight (jangan bold 700+)
- Body: Geist Sans regular 400

**Color palette (CSS variables di `globals.css`):**
```css
--bg-base: #0a0a0a;          /* near-black, bukan pure black */
--bg-surface: #141414;        /* card surface */
--bg-elevated: #1c1c1c;       /* modal, sheet */
--border-subtle: #2a2a2a;
--border-strong: #3a3a3a;
--text-primary: #e8e8e6;
--text-secondary: #9c9a92;
--text-tertiary: #6a6862;
--accent-felt: #1d6b4f;       /* primary action, dealer badge */
--accent-felt-dim: #15493a;
--accent-warn: #b8860b;       /* warning, rebuy indicator (gold-ish) */
--accent-danger: #a03030;     /* destructive */
--accent-success: #5a8a40;
```

**Mobile-first rules:**
- Single column always. No multi-column grids.
- Max viewport width 480px (centered di desktop, padding ke kiri-kanan).
- Tap target minimum 44×44px.
- Primary CTA sticky bottom dengan `padding-bottom: env(safe-area-inset-bottom)`.
- Confirmation dialogs: bottom sheet (slide dari bawah), bukan center modal.
- End-session stack input: 1 pemain per screen, swipe atau "Next" button, bukan form panjang.
- Transition: 150-200ms ease, jangan dramatis.

**Detail aesthetic:**
- Border-radius: 8px (card), 6px (button), 4px (chip pill).
- Border: 1px solid (jangan 0.5px, di mobile susah keliatan).
- Tabular-nums untuk semua angka (`font-variant-numeric: tabular-nums`).
- Currency display: `100` bukan `100.00`, dan `-100` dengan warna `--accent-danger`.
- Loading state: subtle pulse, jangan spinner gede.
- Empty state: text tertiary, 1 sentence, jangan ilustrasi.

---

## Konsep & istilah

- **Balance:** mata uang persistent tiap pemain, disimpan di DB. Bisa minus.
- **Stack:** chip di meja saat sesi aktif (gak di-track real-time, cuma di-input pas end session).
- **Sesi:** satu game poker. Ada start (pilih pemain & dealer) dan end (input stack akhir tiap pemain). Cuma 1 sesi aktif boleh ada dalam satu waktu.
- **Buy-in:** pas pemain ikut sesi, balance kepotong 100. Pemain biasa kena, **dealer GA kena** (gratis, ini "salary"-nya).
- **Rebuy:** pemain bilang dia bust, klik tombol rebuy, balance kepotong 100 lagi. Bisa berkali-kali. Dealer juga bayar 100 kalo rebuy.

---

## Aturan game (logika bisnis)

1. **Pemain baru:** dibuat lewat admin endpoint. Balance awal di-set manual (default 200 kalo ga di-input).
2. **Start sesi:** pilih ≥2 pemain yang ikut, pilih 1 dealer dari mereka. Klik start:
   - Setiap pemain biasa: `balance -= 100` (log entry: `buy_in`).
   - Dealer: balance ga berubah (log entry: `buy_in_dealer_free`).
   - Sesi status: `active`. Catat `started_at`.
3. **Selama sesi aktif:**
   - Tampilan ringkas: list pemain + status (siapa dealer + jumlah rebuy mereka).
   - **Action: Rebuy** (per pemain): `balance -= 100`. Log entry: `rebuy`. Increment `rebuy_count`.
   - **Action: Undo last rebuy** (per pemain): cuma reverse rebuy paling akhir per pemain itu. Balance `+= 100`. Decrement `rebuy_count`. Log entry rebuy yang di-undo di-mark `voided: true` (jangan dihapus). Hanya bisa undo rebuy terakhir dari pemain tsb (FIFO undo dari paling baru). Kalau ga ada rebuy un-voided, tombol disabled.
   - **Action: End session** → ke fase end.
4. **End session (fase input):**
   - Untuk tiap pemain yang ikut sesi (termasuk dealer), input "stack akhir" (jumlah chip mereka pas selesai). Integer ≥ 0.
   - UI: 1 pemain per screen, dengan info "buy-in: 100, rebuy: 200, total dikeluarkan: 300" (atau "buy-in gratis" untuk dealer), terus input number gede.
   - Setelah semua di-input → screen konfirmasi nampilin recap:
     ```
     Pemain A: balance 800 → 950 (+150)
     Pemain B: balance 800 → 670 (-130)
     ...
     ```
   - Klik **Confirm** → apply: `balance += stack_akhir`. Status sesi: `ended`. Catat `ended_at`. Log entry: `session_end` per pemain dengan before/after balance.
   - Klik **Back** → balik ke input, bisa revisi.
5. **Validasi anti-cheat ringan:** total stack akhir semua pemain harus = total chip di meja:
   ```
   total_chip = (jumlah_pemain_biasa × 100) + (total_rebuy × 100)
   ```
   Catatan: dealer ga kontribusi 100 di awal (gratis), jadi dealer **tidak** dihitung di `jumlah_pemain_biasa` walau dia ikut main. Tapi rebuy dealer kontribusi.

   Contoh: 4 pemain ikut (1 dealer + 3 biasa). 3 biasa × 100 = 300. Dealer rebuy 2x = 200. Pemain biasa B rebuy 1x = 100. Total chip = 600.

   Kalau total stack akhir ≠ total chip → tampilkan warning di screen konfirmasi: "Total chip ga sesuai. Seharusnya 600, kamu input 580. Selisih -20. Confirm tetap atau revisi?" — owner boleh tetep confirm (kadang ada chip hilang fisik), tapi harus sadar.

---

## Identitas pemain (localStorage)

- Pas buka web pertama kali (atau identitas belum di-set), tampilin screen "Kamu siapa?" — pilih dari daftar pemain existing. Simpan `playerId` ke localStorage.
- Identitas dipake untuk:
  - Log: setiap action nyimpen `actor_player_id` (siapa yang nge-trigger).
  - Display: "Hi, [Nama]" di header.
- Tombol "Ganti identitas" di header (small text) buat kasih kesempatan ganti.
- Kalau localStorage kosong dan akses langsung ke halaman aktif → redirect ke pilih identitas dulu.

---

## Admin endpoint

- Route: `/admin`
- Query param: `?key=xxx`. Bandingin dengan `process.env.ADMIN_KEY`. Kalau ga match → return 404 (`notFound()`), JANGAN tampilin error message yang ngasih tau ada endpoint admin.
- Halaman admin (mobile-first juga, tapi ga harus secantik halaman pemain):
  - List semua pemain dengan balance.
  - **Tambah pemain:** form nama + balance awal (default 200).
  - **Edit balance manual:** input integer (boleh negatif), wajib isi "alasan" untuk log.
  - **Force-end sesi aktif** (kalau ada sesi yang ga jelas statusnya).
  - **View log:** paginated list semua entry dari `edit_log`, terbaru di atas. Filter by action type.
- Admin key disimpen di env var `ADMIN_KEY`. Generate random 32-char string.

---

## Database schema

Pake plain SQL, simpan migration di `db/migrations/001_init.sql`. Script `pnpm db:migrate` jalanin file ini ke `DATABASE_URL`.

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- partial unique index: cuma 1 sesi active boleh ada
CREATE UNIQUE INDEX one_active_session ON sessions (status) WHERE status = 'active';

CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  is_dealer BOOLEAN NOT NULL DEFAULT false,
  rebuy_count INTEGER NOT NULL DEFAULT 0,
  final_stack INTEGER,
  UNIQUE (session_id, player_id)
);

CREATE TABLE edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  actor_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  -- action enum: 'buy_in', 'buy_in_dealer_free', 'rebuy', 'rebuy_undo',
  -- 'session_end', 'admin_balance_edit', 'admin_player_add', 'admin_session_force_end'
  balance_before INTEGER,
  balance_after INTEGER,
  metadata JSONB,
  -- metadata.reason untuk admin edit, metadata.voided=true untuk rebuy yg di-undo
  voided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX edit_log_session_idx ON edit_log (session_id, created_at DESC);
CREATE INDEX edit_log_player_idx ON edit_log (player_id, created_at DESC);
```

**Concurrency:** Pake Postgres transaction (`BEGIN ... COMMIT`) untuk SEMUA operasi yang baca-modify-tulis (rebuy, undo, end session). Wrap di `sql.begin()` atau pake `sql` template tag dengan transaction. Race condition utama: 2 orang klik rebuy bareng untuk pemain yang sama. Solve dengan `SELECT ... FOR UPDATE` di row player.

---

## Routes & file structure

```
app/
  layout.tsx              # global layout, dark mode, fonts
  page.tsx                # home: identity check → either identity-picker atau dashboard
  globals.css             # CSS vars, base styles

  identity/
    page.tsx              # pilih siapa kamu (kalau localStorage kosong)

  (main)/                 # group route, semua butuh identitas
    layout.tsx            # check identity client-side, redirect ke /identity kalo ga ada
    page.tsx              # dashboard: list pemain + balance, tombol start/resume sesi
    session/
      page.tsx            # sesi aktif: list peserta, rebuy/undo, end
      setup/
        page.tsx          # pilih pemain + dealer
      end/
        page.tsx          # input stack akhir per pemain (multi-step)

  admin/
    page.tsx              # admin dashboard (cek key di server)

  api/
    poll/
      route.ts            # GET endpoint untuk polling state terbaru

lib/
  db.ts                   # vercel postgres setup
  actions/                # server actions
    players.ts            # admin CRUD pemain
    session.ts            # start, rebuy, undo, end session
  types.ts                # TS types untuk Player, Session, etc.

components/
  PlayerCard.tsx
  BalanceDisplay.tsx
  Sheet.tsx               # bottom sheet primitive
  Button.tsx
  ...etc

db/
  migrations/
    001_init.sql
  migrate.ts              # script untuk run migrations
```

---

## Screens (mobile-first wireframe ala teks)

### 1. `/identity` — pilih identitas
```
┌─────────────────────┐
│  Pilih nama kamu    │
│                     │
│  [ Reza         ]   │
│  [ Andi         ]   │
│  [ Budi         ]   │
│  [ Citra        ]   │
│                     │
└─────────────────────┘
```
Tap nama → simpan ke localStorage → redirect ke `/`.

### 2. `/` — dashboard
```
┌─────────────────────┐
│ Hi, Reza  [ganti]   │
├─────────────────────┤
│  PEMAIN             │
│                     │
│  Reza      ◯ 850    │
│  Andi      ◯ 720    │
│  Budi      ◯ 150    │
│  Citra     ◯ 200    │
│                     │
│  [sesi aktif card   │ ← kalau ada sesi active
│   tap untuk lanjut] │
│                     │
├─────────────────────┤
│  [ Mulai sesi  ]    │ ← sticky bottom
└─────────────────────┘
```
Kalau ada sesi `active`: tampilin card "Sesi sedang berjalan, tap untuk lanjut". Tombol mulai sesi disabled.

### 3. `/session/setup` — setup sesi
```
┌─────────────────────┐
│ ← Setup sesi        │
├─────────────────────┤
│  PILIH PEMAIN       │
│  ☑ Reza             │
│  ☑ Andi             │
│  ☑ Budi             │
│  ☐ Citra            │
│                     │
│  PILIH DEALER       │
│  ○ Reza             │
│  ● Andi             │
│  ○ Budi             │
│                     │
├─────────────────────┤
│  [   Mulai      ]   │
└─────────────────────┘
```
Dealer radio cuma muncul untuk pemain yang dicentang. Validasi: min 2 pemain ikut, harus pilih dealer.

### 4. `/session` — sesi aktif
```
┌─────────────────────┐
│ ← Sesi aktif   [End]│
├─────────────────────┤
│  Andi      ★ DEALER │
│  Rebuy: 0           │
│  [ Rebuy ] [ Undo ] │
│                     │
│  Reza               │
│  Rebuy: 2           │
│  [ Rebuy ] [ Undo ] │
│                     │
│  Budi               │
│  Rebuy: 1           │
│  [ Rebuy ] [ Undo ] │
│                     │
└─────────────────────┘
```
- Tombol `Rebuy` → konfirmasi bottom sheet "Rebuy [nama]? Balance kepotong 100. [Cancel] [Rebuy]".
- Tombol `Undo` disabled kalau rebuy_count == 0 atau semua rebuy udah di-void.

### 5. `/session/end` — input stack akhir
Multi-step, 1 pemain per screen.
```
┌─────────────────────┐
│ ← End sesi   1 / 4  │
├─────────────────────┤
│                     │
│       Andi          │
│     ★ DEALER        │
│                     │
│  Buy-in: gratis     │
│  Rebuy: 0           │
│                     │
│  Stack akhir:       │
│  ┌───────────────┐  │
│  │      120      │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│  [    Next →    ]   │
└─────────────────────┘
```
Setelah semua → screen konfirmasi (single screen recap):
```
┌─────────────────────┐
│ ← Konfirmasi        │
├─────────────────────┤
│  RECAP              │
│                     │
│  Andi      ★        │
│  850 → 970  (+120)  │
│                     │
│  Reza               │
│  850 → 720  (-130)  │
│                     │
│  Budi               │
│  150 → 280  (+130)  │
│                     │
│  Total chip: 600    │
│  Input: 580         │
│  ⚠ Selisih -20      │
│                     │
├─────────────────────┤
│ [ Back ][ Confirm ] │
└─────────────────────┘
```

### 6. `/admin?key=xxx`
Halaman admin. Fungsinya sesuai bagian Admin Endpoint di atas.

---

## Polling sync

Tiap client polling `GET /api/poll` setiap 2 detik. Endpoint return:
```ts
{
  players: Player[],
  activeSession: SessionWithParticipants | null,
}
```
Re-render kalau data berubah (compare by JSON.stringify atau pake key version dari DB).

Polling cuma jalan di halaman yang butuh real-time data (`/`, `/session`). Halaman lain (admin, end input) ga polling.

---

## Hal-hal yang DITUNDA (jangan implement, tapi sisain hooks)

- Max pool chip (cap inflasi total chip di sistem) → sisain kolom `metadata` di `sessions` buat nampung config nanti.
- Multi-sesi paralel.
- Authentication beneran (cuma localStorage identity sekarang).
- Edit balance pemain biasa (cuma admin).
- Hapus pemain dari UI biasa (cuma admin).
- Per-hand tracking (siapa menang dari siapa).
- Rename pemain.
- History view di app pemain biasa (cuma admin yang bisa lihat).

---

## Acceptance criteria

Build dianggap selesai kalau:

1. Bisa add pemain baru lewat `/admin?key=xxx` dengan balance awal custom.
2. Bisa start sesi: pilih pemain, pilih dealer, balance pemain biasa kepotong 100, dealer ga kepotong.
3. Bisa rebuy: balance kepotong 100, rebuy_count++.
4. Bisa undo rebuy: balance balik +100, rebuy_count--, log entry voided.
5. Bisa end sesi: input stack akhir per pemain, lihat recap, confirm → balance ter-update sesuai stack akhir.
6. Validasi total chip muncul kalau selisih, tapi tetap bisa di-override.
7. Mobile-first: tested di viewport 375×667 (iPhone SE) dan 390×844 (iPhone 14).
8. Dark mode default, ga ada light mode toggle.
9. Polling 2 detik bikin perubahan dari satu device kelihatan di device lain dalam ≤3 detik.
10. Admin endpoint return 404 kalau key salah/kosong.
11. Cuma 1 sesi `active` boleh ada (constraint DB).
12. Identity localStorage: kalau ga ada, redirect ke `/identity`.

---

## Yang Claude Code harus tanya ke user kalau ambigu

- Nama-nama pemain awal (kalau owner mau pre-seed via migration).
- Style fonts kalau Geist ga available di lokal.

Selain itu: ikuti spec letter for letter. Kalau ada konflik antara spec dan "best practice umum", **ikuti spec**.
