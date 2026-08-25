import type { Metadata } from 'next'
import { Inter, Noto_Sans_Arabic } from 'next/font/google'
import { LOCALE_STORAGE_KEY } from '@hoodna/i18n'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import { SonnerToaster } from '@/components/sonner-toaster'
import { Header } from '@/components/header'
import { AppContentLayout } from '@/components/app-content-layout'
import { AppVersionBadge } from '@/components/app-version-badge'

const localeBootstrapScript = `
(function () {
  try {
    var locale = localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});
    if (locale === 'ar' || locale === 'en') {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset.locale = locale;
    }
  } catch (e) {}
})();
`

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
  metadataBase: new URL('https://eljiran.io'),
  title: 'eljiran.io - Verified Neighborhood Community',
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
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${inter.variable} ${notoSansArabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
      </head>
      <body className="font-sans">
        <Providers>
          <Header />
          <AppContentLayout>{children}</AppContentLayout>
        </Providers>
        <Toaster />
        <SonnerToaster />
        <AppVersionBadge />
      </body>
    </html>
  )
}
