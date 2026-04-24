import React from 'react'
import { cn } from './utils'

export interface ScrollAreaProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative w-full h-full overflow-hidden',
        className
      )}
      {...props}
    >
      <div className="w-full h-full overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  )
)

ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
