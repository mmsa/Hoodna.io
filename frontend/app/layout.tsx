import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import { SonnerToaster } from '@/components/sonner-toaster'
import { Header } from '@/components/header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'eljiran.com - Verified Neighborhood Community',
  description: 'Verified neighborhood community and marketplace',
  icons: {
    icon: '/icon_light.jpg',
    apple: '/icon_light.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Header />
          {children}
        </Providers>
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  )
}

