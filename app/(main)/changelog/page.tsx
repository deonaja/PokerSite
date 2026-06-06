import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CHANGELOG } from '@/lib/changelog'
import MarkChangelogSeen from '@/components/MarkChangelogSeen'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChangelogPage() {
  return (
    <div className="pb-8">
      <MarkChangelogSeen />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center text-lg text-muted-foreground no-underline"
        >
          ←
        </Link>
        <span className="text-sm font-medium text-foreground">Apa yang baru</span>
      </div>

      <div className="px-4 pt-5">
        {CHANGELOG.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Belum ada catatan perubahan.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {CHANGELOG.map((entry) => (
              <Card key={entry.version} className="px-4 py-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="font-mono normal-case tracking-normal">v{entry.version}</Badge>
                  <span className="ml-auto font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
                    {formatDate(entry.date)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex gap-2 text-[0.8125rem] leading-snug text-foreground">
                      <span aria-hidden className="text-primary">•</span>
                      <span className="min-w-0">{change}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
