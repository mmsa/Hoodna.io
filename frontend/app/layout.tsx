import type { Metadata } from 'next'
import { Inter, Noto_Sans_Arabic } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import { SonnerToaster } from '@/components/sonner-toaster'
import { Header } from '@/components/header'
import { AppContentLayout } from '@/components/app-content-layout'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-arabic',
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
    <html lang="en" className={`${inter.variable} ${notoSansArabic.variable}`}>
      <body className="font-sans">
        <Providers>
          <Header />
          <AppContentLayout>{children}</AppContentLayout>
        </Providers>
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  )
}
