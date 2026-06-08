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
