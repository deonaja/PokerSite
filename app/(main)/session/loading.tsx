export default function Loading() {
  return (
    <div>
      {/* Sticky header skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ height: '36px', width: '80px', borderRadius: '6px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: '36px', width: '56px', borderRadius: '6px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>

      {/* Participant card skeletons */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: '104px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
