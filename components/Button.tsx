import { forwardRef } from 'react'

import { Button as UIButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}

// Legacy API kept so the 13 existing call-sites don't change.
// Maps the old variant names onto the shadcn button.
const variantMap = {
  primary: 'default',
  secondary: 'outline',
  danger: 'destructive',
} as const

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', fullWidth, className, ...props }, ref) => (
    <UIButton
      ref={ref}
      variant={variantMap[variant]}
      className={cn(fullWidth && 'w-full', className)}
      {...props}
    />
  )
)

Button.displayName = 'Button'
export default Button
