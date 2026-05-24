export default function Loading() {
  return (
    <div style={{ padding: '3rem 1rem 2rem' }}>
      <div
        style={{
          height: '0.875rem',
          width: '6rem',
          borderRadius: '4px',
          background: 'var(--bg-elevated)',
          marginBottom: '1.5rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: '44px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
