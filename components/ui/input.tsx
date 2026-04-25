import React from 'react'
import { cn } from './utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-black px-3 py-2 text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
