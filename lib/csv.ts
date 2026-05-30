// Minimal CSV serializer. RFC-4180-ish: CRLF rows, fields quoted only when they
// contain a comma, quote, or newline; embedded quotes doubled. Objects (e.g. JSON
// metadata) are JSON-stringified; null/undefined become empty cells.
export interface CsvColumn {
  key: string
  label: string
}

function escapeCell(value: unknown): string {
  if (value == null) return ''
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(',')).join('\r\n')
  // Leading BOM so Excel opens UTF-8 (player names) correctly.
  return '﻿' + header + '\r\n' + (body ? body + '\r\n' : '')
}
