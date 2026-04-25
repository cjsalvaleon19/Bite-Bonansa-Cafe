import React from 'react'
import { cn } from './utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-black px-3 py-2 text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
