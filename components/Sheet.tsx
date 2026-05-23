'use client'

import { useEffect } from 'react'

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 150ms ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) translateY(${isOpen ? '0' : '100%'})`,
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-elevated)',
          borderRadius: '12px 12px 0 0',
          borderTop: '1px solid var(--border-strong)',
          padding: '1.25rem 1rem',
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
          zIndex: 50,
          transition: 'transform 200ms ease',
        }}
      >
        {title && (
          <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            {title}
          </p>
        )}
        {children}
      </div>
    </>
  )
}
