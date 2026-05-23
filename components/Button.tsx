import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth, children, style, ...props }, ref) => {
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: 'var(--accent-felt)',
        color: 'var(--text-primary)',
      },
      secondary: {
        background: 'transparent',
        border: '1px solid var(--border-strong)',
        color: 'var(--text-primary)',
      },
      danger: {
        background: 'var(--accent-danger)',
        color: 'var(--text-primary)',
      },
    }

    return (
      <button
        ref={ref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: 500,
          minHeight: '44px',
          padding: '0 1rem',
          width: fullWidth ? '100%' : undefined,
          transition: 'opacity 150ms ease',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.4 : 1,
          border: 'none',
          ...variantStyles[variant ?? 'primary'],
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
