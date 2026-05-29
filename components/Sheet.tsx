'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'

import { cn } from '@/lib/utils'

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

// Controlled bottom sheet built on Radix Dialog. Same props as before so
// call-sites don't change; gains focus-trap, Esc-to-close, scroll-lock, a11y.
export default function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/60',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:duration-150 data-[state=closed]:duration-150'
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px]',
            'rounded-t-xl border-t border-input bg-popover',
            'px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'data-[state=open]:duration-200 data-[state=closed]:duration-150'
          )}
        >
          <DialogPrimitive.Title
            className={cn(
              'mb-1.5 text-[0.9375rem] font-medium text-foreground',
              !title && 'sr-only'
            )}
          >
            {title ?? 'Konfirmasi'}
          </DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
