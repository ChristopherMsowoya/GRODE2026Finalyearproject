import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { UserProvider } from '@/lib/user-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'GRODE-Climate Intelligent System',
  description: 'Early-Season Rainfall Intelligence for Malawi farmers. Monitor onset patterns, false-onset risk, and dry spell to optimize planting decisions.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <UserProvider>
          {children}
        </UserProvider>
        <Analytics />
      </body>
    </html>
  )
}
