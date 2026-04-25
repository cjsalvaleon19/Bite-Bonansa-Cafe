import React, { useState } from 'react'
import { cn } from './utils'

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

const TabsContext = React.createContext<{
  activeTab: string
  onTabChange: (value: string) => void
}>({
  activeTab: '',
  onTabChange: () => {},
})

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
    const [activeTab, setActiveTab] = useState(defaultValue || '')

    const handleTabChange = (newValue: string) => {
      setActiveTab(newValue)
      onValueChange?.(newValue)
    }

    return (
      <TabsContext.Provider
        value={{
          activeTab: value !== undefined ? value : activeTab,
          onTabChange: handleTabChange,
        }}
      >
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)

Tabs.displayName = 'Tabs'

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-card border p-1',
      className
    )}
    {...props}
  />
))

TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const { activeTab, onTabChange } = React.useContext(TabsContext)
    const isActive = activeTab === value

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onTabChange(value)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          className
        )}
        {...props}
      />
    )
  }
)

TabsTrigger.displayName = 'TabsTrigger'

export { Tabs, TabsList, TabsTrigger }
