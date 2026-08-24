// User-facing changelog. Newest entry first. Bump by adding an entry on top
// whenever a player-visible feature ships. Versions stay below 1.0 on purpose
// (prod still rough). The first entry's version drives the "new" dot in the
// header (see HeaderMenu): if a player's last-seen version != LATEST_VERSION,
// the dot shows until they open /changelog.

export interface ChangelogEntry {
  version: string
  date: string // ISO yyyy-mm-dd
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.16.0',
    date: '2026-08-24',
    changes: [
      'TAMPILAN BARU TOTAL cuy — sekarang gaya "teletext": layar item, angka gede warna cyan, font pixel, semua siku. Vibe underground, bukan casino norak.',
      'Avatar baru: tiap orang dapet keping poker pixel warna sendiri — gampang bedain siapa-siapa.',
      'Tab atas ganti: SESI diganti PROFIL (langsung ke statistik lo). Mulai sesi tetep lewat tombol gede di bawah.',
      'Achievement dirombak: ikon lebih detail, dan sekarang tinggal TAP kategorinya buat liat syarat tiap tingkat + progress lo (dulu cuma bisa di-hover, percuma di HP).',
      'Fix: dulu ada kondisi ga bisa bikin musim baru kalau belum login padahal udah ada pemain — sekarang otomatis diarahin login dulu, ga mentok lagi.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-06-30',
    changes: [
      'Akhir musim sekarang ada podium top 3 — 3rd, 2nd, 1st muncul satu-satu, juara dapet kilau emas dikit (sekali doang, ga lebay). Sisanya tetep list biasa di bawah.',
      'Fix bug: kalau abis end sesi terakhir lo close app sebelum konfirmasi end season, sekarang otomatis ke-redirect balik ke layar end season. Ga bisa start sesi lagi karena musimnya emang udah habis — selesaiin dulu, baru bisa lanjut musim baru.',
      'Bonus: chart performa /player/[id] kemarin di-update ke per-musim picker (bukan lifetime toggle) + titik sesi 0 ga lagi ke-potong di pinggir kiri.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-06-29',
    changes: [
      'Achievement upgrade GEDE: tiap kategori sekarang ada 3 tingkat (bintang 1/2/3) — Bandar, Juara, Podium, Veteran, Sultan, Untung. Total 18 tingkat lifetime dengan ikon custom (bukan emoji default).',
      'Buka /player/[id] buat liat progress lo per kategori. Yang udah ke-unlock full color, yang belum abu-abu sama ada hint "X/Y" buat tingkat selanjutnya.',
      'Admin: fitur ROLLBACK is here cuy. Bisa balikin state DB ke titik mana pun di log (cuma session start/end, season start, admin edit balance) — tipe "ROLLBACK" 3x buat konfirmasi. Yang udah lewat season end ga bisa di-rollback (immutable).',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-06-29',
    changes: [
      'Dealer netral (cuma bagi kartu) sekarang dapet gaji lebih gede: 1× chip di meja + 1× ke saldo (cadangan) = 2× total. Yang ikut main cuma dapet 1× chip doang. Logikanya: yang kerja yang dibayar — biar ada yang mau jadi dealer netral cuy.',
      'Phase 2 sekarang dijamin jalan full sesuai target — kalau Phase 1 molor lebih dari estimasi, Phase 2 nggak dipotong (sebelumnya total sesi fixed jadi P2 sering kepotong).',
      'Notif pindah Phase 2 sekarang langsung muncul pas sesi terakhir P1 selesai (sebelumnya muncul pas mau mulai sesi P2 pertama).',
      'Fix tampilan setup di Phase 2: badge cooldown udah ga muncul (cooldown cuma di P1), deskripsi dealer ganti ke info rake.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-06-29',
    changes: [
      'Yang start sesi sekarang bisa langsung batalin sesi sendiri (tombol "Batalkan sesi" muncul di /session) — gausa buka admin lagi cuy.',
      'Profile pemain: stat baru "Streak menang" + "Streak terpanjang" — biar tau lo lagi panas atau dingin.',
      'Profile pemain: ada chart performa balance per sesi, toggle Musim ini / Lifetime. Liat naik-turun saldo lo tiap sesi.',
      'Fix riwayat musim: tampilan buy-in udah bener (sebelumnya kebawa rumus lama dari sebelum Fase A).',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-06-29',
    changes: [
      'Notifikasi HP udah jalan cuy! Buka menu akun → "Notifikasi" → Aktifkan. Sekarang dapet notif pas ada yang minjem ke kamu, pinjaman kamu disetujui/ditolak, atau dilunasin — walau app-nya lagi ditutup.',
      'iPhone: install dulu ke layar utama (lewat menu Bagikan), baru bisa aktifin notif. Android/desktop tinggal aktifin langsung.',
      'Ganti identitas/logout sekarang otomatis matiin notif di device itu — jadi orang berikutnya yang pake HP lo gak bakal kebanjiran notif lo.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-06-09',
    changes: [
      'Sekarang bisa di-install ke HP cuy! buka menu browser → "Tambahkan ke layar utama", langsung full-screen kaya app beneran (ada iconnya juga).',
      'Riwayat sesi is here!! biar bisa liat orang kalahan yang mana',
      'Fix keterangan dealer: pas dealer lagi cooldown trus pilih "cuma bagi kartu", sekarang jelas tulisannya gak dapet gaji.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-06-09',
    changes: [
      'Fitur join di tengah sesi udah up cuy. tinggal tambahin pas sesi aktip',
      'Fix list anggota yang gaje jir.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-06-08',
    changes: [
      'Minjem udah bisa cuy, kalo saldo dibawah buy in kalian bisa pinjem ke pemain lain dengan catatan pemain lain tersebut harus setuju dengan pinjaman tersebut. pinjaman bisa dibayar kapan aja dan kalo keburu season end nanti di potong balance akhir season.',
      'Register is here!!! pemain baru bisa register dengan kode yang dikasi undangan dari atmin.',
      'Pemain lama bisa gabung musim yang udah jalan langsung dari dashboard.',
      'Guest mode is here too!!! biar bisa jadi porto wkwkkw',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-06-08',
    changes: [
      'Setup musim baru: tentukan buy-in + jumlah nyawa (modal awal = buy-in × nyawa), lalu pilih tempo & durasi.',
      'Pilih anggota lewat checklist saat bikin musim — dashboard hanya menampilkan pemain yang ikut musim aktif.',
      'Dealer bisa "cuma bagi kartu" (netral) saat 4+ pemain; gaji dealer & rake menyesuaikan per fase.',
      'Dashboard menampilkan progress pool menuju fase berikutnya + notifikasi sekali saat fase berganti.',
      'Halaman Panduan (ikon "?" di header) + sambutan singkat untuk pemain baru.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-06-06',
    changes: [
      'Durasi sesi: timer jalan saat sesi aktif dan di recap akhir.',
      'Statistik pemain: total waktu main + rata-rata per sesi.',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-06-06',
    changes: [
      'Rebuy lebih fleksibel: tetap bisa rebuy walau saldo di bawah buy-in (ambil sisa saldo, saldo tidak minus).',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-06-06',
    changes: [
      'Admin bisa "Batalkan sesi": buy-in dikembalikan ke pemain dan sesi dihapus.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-05-31',
    changes: [
      'Export data ke CSV (hasil musim, log, pemain, sesi) dari panel admin.',
      'Sistem pencapaian: badge dibagikan saat musim berakhir.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-31',
    changes: [
      'Tampilan baru felt-green dengan dashboard podium juara.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-30',
    changes: [
      'Riwayat musim dan statistik per pemain.',
    ],
  },
]

export const LATEST_VERSION = CHANGELOG[0]?.version ?? '0.0.0'

// localStorage key holding the latest version a player has already seen.
export const CHANGELOG_SEEN_KEY = 'changelog_seen'
