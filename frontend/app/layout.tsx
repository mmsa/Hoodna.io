import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import { SonnerToaster } from '@/components/sonner-toaster'
import { Header } from '@/components/header'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

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
      <body className={plusJakarta.className}>
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

