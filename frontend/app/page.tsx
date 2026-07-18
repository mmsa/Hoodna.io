'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Shield,
  Users,
  ShoppingBag,
  MessageCircle,
  CheckCircle,
  ArrowRight,
  Lock,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useTranslation } from '@/components/locale-provider'
import { formatCompoundName } from '@/lib/format-compound'

export default function Home() {
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const features = [
    {
      icon: Shield,
      title: t('landing.featureVerifiedTitle'),
      description: t('landing.featureVerifiedDesc'),
    },
    {
      icon: ShoppingBag,
      title: t('landing.featureMarketTitle'),
      description: t('landing.featureMarketDesc'),
    },
    {
      icon: Users,
      title: t('landing.featureNoAgentsTitle'),
      description: t('landing.featureNoAgentsDesc'),
    },
    {
      icon: MessageCircle,
      title: t('landing.featureFeedTitle'),
      description: t('landing.featureFeedDesc'),
    },
    {
      icon: Lock,
      title: t('landing.featureSecureTitle'),
      description: t('landing.featureSecureDesc'),
    },
    {
      icon: TrendingUp,
      title: t('landing.featurePromoteTitle'),
      description: t('landing.featurePromoteDesc'),
    },
  ]

  const steps = [
    {
      number: '01',
      title: t('landing.step1Title'),
      description: t('landing.step1Desc'),
    },
    {
      number: '02',
      title: t('landing.step2Title'),
      description: t('landing.step2Desc'),
    },
    {
      number: '03',
      title: t('landing.step3Title'),
      description: t('landing.step3Desc'),
    },
    {
      number: '04',
      title: t('landing.step4Title'),
      description: t('landing.step4Desc'),
    },
  ]

  const benefits = [
    t('landing.benefit1'),
    t('landing.benefit2'),
    t('landing.benefit3'),
    t('landing.benefit4'),
    t('landing.benefit5'),
    t('landing.benefit6'),
  ]

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border/70 px-4 py-20 md:py-28">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">
            {t('landing.eyebrow')}
          </p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            {t('landing.headlineLine1')}
            <br />
            {t('landing.headlineLine2')}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t('landing.subtitle')}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {mounted && isAuthenticated ? (
              <>
                <Link href="/feed">
                  <Button size="lg" className="min-w-[180px]">
                    {t('landing.goToFeed')}
                    <ArrowRight className="ms-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/marketplace">
                  <Button size="lg" variant="outline" className="min-w-[180px]">
                    {t('landing.browseMarketplace')}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/signup">
                  <Button size="lg" className="min-w-[180px]">
                    {t('landing.getStarted')}
                    <ArrowRight className="ms-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="min-w-[180px]">
                    {t('landing.signIn')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-border pt-10">
            <div>
              <p className="text-3xl font-bold text-primary">100%</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('landing.statVerified')}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">0</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('landing.statAgentFees')}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">1</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('landing.statCompound')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              {t('landing.featuresTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="eljiran-card border-border/70">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/40 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">{t('landing.howTitle')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t('landing.howSubtitle')}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number}>
                <p className="mb-3 text-sm font-bold text-primary">{step.number}</p>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <Card className="eljiran-card">
            <CardContent className="p-8">
              <h3 className="mb-6 text-center text-2xl font-bold text-foreground">
                {t('landing.whyTitle')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {benefits.map((text) => (
                  <div key={text} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">{t('landing.testimonialsTitle')}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: 'Ahmed Mohamed',
                compound: formatCompoundName('Tagamoa New Cairo'),
                text: 'Easy to connect with neighbours and sell furniture. Verification gave me confidence I was dealing with real residents.',
              },
              {
                name: 'Sara Ali',
                compound: formatCompoundName('Zayed'),
                text: 'Finally a marketplace without agents. I sold my car directly to a neighbour in my compound.',
              },
              {
                name: 'Mohamed Hassan',
                compound: formatCompoundName('New Capital'),
                text: 'The community feed keeps everyone in the loop. Great deals and real connections.',
              },
            ].map((testimonial) => (
              <Card key={testimonial.name} className="eljiran-card">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.compound}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{testimonial.text}&rdquo;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-20">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
            {t('landing.ctaTitle')}
          </h2>
          <p className="mb-8 text-primary-foreground/90">
            {t('landing.ctaSubtitle')}
          </p>
          {mounted && isAuthenticated ? (
            <Link href="/feed">
              <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                {t('landing.goToFeed')}
                <ArrowRight className="ms-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/signup">
                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                  {t('landing.getStarted')}
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  {t('landing.signIn')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
