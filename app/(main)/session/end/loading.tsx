export default function Loading() {
  return (
    <div>
      {/* Header skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ height: '36px', width: '80px', borderRadius: '6px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: '1rem', width: '3rem', borderRadius: '4px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>

      {/* Content skeleton */}
      <div style={{ padding: '2rem 1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ height: '1.5rem', width: '8rem', borderRadius: '4px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: '80px', width: '100%', borderRadius: '8px', background: 'var(--bg-surface)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '100ms' }} />
        <div style={{ height: '72px', width: '100%', borderRadius: '8px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '200ms' }} />
      </div>
    </div>
  )
}
