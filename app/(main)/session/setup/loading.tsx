export default function Loading() {
  return (
    <div style={{ padding: '1.5rem 1rem 0' }}>
      <div
        style={{
          height: '1rem',
          width: '5rem',
          borderRadius: '4px',
          background: 'var(--bg-elevated)',
          marginBottom: '1rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: '52px',
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
