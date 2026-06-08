import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import MarkGuideSeen from '@/components/MarkGuideSeen'

export const metadata = {
  title: 'Panduan',
}

// Public (no auth) so it's reachable from /identity and the welcome sheet too.
// Static JSX content — no DB, no markdown renderer. Accordion = native <details>.
export default function PanduanPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-background pb-10">
      <MarkGuideSeen />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-muted-foreground no-underline"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-medium text-foreground">Panduan</span>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-5">
        {/* Overview — the main flow, always visible */}
        <div>
          <h1 className="m-0 mb-1 text-lg font-medium text-foreground">Cara main, singkat</h1>
          <p className="m-0 mb-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
            App ini cuma ngitung chip & saldo — kartunya tetep main di meja beneran.
          </p>
          <Card className="flex flex-col gap-2.5 px-4 py-3.5">
            {[
              ['Pilih identitas', 'Tap nama kamu, masukin PIN (default 1234).'],
              ['Mulai sesi', 'Centang siapa yang main, pilih dealer.'],
              ['Main + rebuy', 'Saldo kurang di tengah jalan? Rebuy (potong saldo).'],
              ['Tutup sesi', 'Isi chip akhir tiap orang → saldo otomatis di-update.'],
              ['Akhir musim', 'Setelah sekian sesi, musim ditutup → leaderboard + reset.'],
            ].map(([title, desc], i) => (
              <div key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary bg-accent font-mono text-xs tabular-nums text-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-sm font-medium text-foreground">{title}</p>
                  <p className="m-0 text-[0.8125rem] leading-snug text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <p className="m-0 text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Selengkapnya (tap buat buka)
        </p>

        <Section title="Modal & nyawa">
          <P>
            Tiap musim ditentukan <B>buy-in</B> (1 stack di meja) dan <B>nyawa</B>{' '}
            (berapa kali bisa isi ulang). Modal awal tiap pemain ={' '}
            <B>buy-in × nyawa</B> — misal buy-in 100 × 5 nyawa = saldo 500.
          </P>
          <P>
            <B>Rebuy</B> motong 1 buy-in dari saldo buat balik ke meja. Kalau saldo
            kurang dari 1 buy-in, rebuy ambil sisa saldo (saldo ga pernah minus).
            Saldo habis = ga bisa rebuy lagi.
          </P>
        </Section>

        <Section title="Dealer & gaji">
          <P>
            Tiap sesi ada 1 dealer (bagi kartu). Dealer bisa <B>ikut main</B> atau
            (kalau pemain 4+) jadi <B>dealer netral</B> yang cuma bagi kartu.
          </P>
          <P>
            <B>Phase 1 (Bootstrap):</B> dealer main gratis (saldo ga kepotong) +
            dapet 2× buy-in gaji — 1× stack di meja, 1× masuk saldo (nyawa cadangan).
            Dealer netral dapet flat 1× buy-in. Habis jadi dealer, ada{' '}
            <B>cooldown</B> 2 sesi — masih boleh jadi dealer tapi ga dapet gaji gratis.
          </P>
          <P>
            <B>Phase 2 (Steady):</B> dealer yang ikut main = pemain biasa, bayar
            buy-in, <B>ga ambil rake</B>. Dealer netral yang ambil rake (lihat Rake).
          </P>
        </Section>

        <Section title="Phase 1 (Bootstrap) vs Phase 2 (Steady)">
          <P>
            <B>Phase 1 / Bootstrap:</B> chip baru terus disuntik ke meja (lewat gaji
            dealer), jadi total pool naik tiap sesi. Dashboard nampilin{' '}
            <B>bar pool</B> (total saldo / max pool). Begitu pool nyentuh max pool,
            musim pindah ke Phase 2.
          </P>
          <P>
            <B>Phase 2 / Steady:</B> ga ada cetak chip lagi — murni zero-sum (yang
            menang dapet dari yang kalah) + rake buat dealer netral. Dashboard
            nampilin sisa sesi sampai musim berakhir.
          </P>
        </Section>

        <Section title="Rake">
          <P>
            Rake = potongan kecil tiap pot, jatah <B>dealer netral</B> di Phase 2
            (kayak house di kasino — adil karena dealer netral ga ikut tanding).
          </P>
          <P>
            App ga otomatis motong rake. Dealer ngambil chip rake langsung di meja;
            di akhir sesi ada <B>kalkulator rake</B> (estimasi total, dibulatkan ke 5
            terdekat) buat bantu. Dealer yang ikut main ga narik rake.
          </P>
        </Section>

        <Section title="Musim: durasi, reset, leaderboard">
          <P>
            Tiap musim punya jumlah sesi (preset: Sprint/Quick/Standard/Marathon atau
            custom). Setelah sesi terakhir, musim otomatis ke tahap akhir →{' '}
            <B>leaderboard</B> (ranking saldo), lalu semua saldo di-reset ke modal awal
            buat musim baru.
          </P>
          <P>
            Hasil tiap musim disimpan di <B>Riwayat musim</B>, dan pemain ngumpulin{' '}
            <B>pencapaian</B> (achievement) lintas-musim. Statistik per-pemain ada di
            halaman profil masing-masing.
          </P>
        </Section>

        <Section title="Admin (opsional)">
          <P>
            Halaman admin (di-gerbang kunci) buat hal teknis: tambah pemain, edit
            saldo manual (wajib alasan), batalin sesi (refund), akhiri musim, export
            CSV, dan lihat log. Semua perubahan saldo tercatat & ga bisa dihapus.
          </P>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3.5">
        {children}
      </div>
    </details>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[0.8125rem] leading-relaxed text-muted-foreground">{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>
}
