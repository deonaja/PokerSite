import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        warn: 'border-transparent bg-warn text-primary-foreground',
        success: 'border-transparent bg-success text-primary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
