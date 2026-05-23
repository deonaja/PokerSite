export default function Loading() {
  return (
    <div style={{ padding: '1.5rem 1rem 0' }}>
      <div
        style={{
          height: '1rem',
          width: '4rem',
          borderRadius: '4px',
          background: 'var(--bg-elevated)',
          marginBottom: '0.75rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: '44px',
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
