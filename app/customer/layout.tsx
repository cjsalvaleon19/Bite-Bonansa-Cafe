import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Portal - Bite Bonanza Cafe',
  description: 'Browse menu and place orders',
}

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
