'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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
import { SiteFooter } from '@/components/site-footer'
import { BrandLockup } from '@/components/brand-lockup'
import { CompoundThread } from '@/components/compound-thread'
import { StoreBadges } from '@/components/store-badges'

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
  ]

  const shots = [
    {
      src: '/marketing/compound-courtyard.jpg',
      alt: t('landing.altCourtyard'),
      title: t('landing.shotCourtyardTitle'),
      body: t('landing.shotCourtyardBody'),
    },
    {
      src: '/marketing/porch-table.jpg',
      alt: t('landing.altTable'),
      title: t('landing.shotTableTitle'),
      body: t('landing.shotTableBody'),
    },
    {
      src: '/marketing/balcony-phone.jpg',
      alt: t('landing.altBalcony'),
      title: t('landing.shotBalconyTitle'),
      body: t('landing.shotBalconyBody'),
    },
  ]

  const actions = mounted && isAuthenticated ? (
    <>
      <Link href="/feed">
        <Button size="lg" className="min-w-[180px]">
          {t('landing.goToFeed')}
          <ArrowRight className="ms-2 h-4 w-4" />
        </Button>
      </Link>
      <Link href="/marketplace">
        <Button size="lg" variant="outline" className="min-w-[180px] border-white/40 bg-white/10 text-white hover:bg-white/20">
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
        <Button size="lg" variant="outline" className="min-w-[180px] border-white/40 bg-white/10 text-white hover:bg-white/20">
          {t('landing.signIn')}
        </Button>
      </Link>
    </>
  )

  return (
    <main className="eljiran-bleed bg-background">
      <section className="relative min-h-[92vh] overflow-hidden">
        <Image
          src="/marketing/compound-street.jpg"
          alt={t('landing.altStreet')}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#10211e]/35" />
        <div className="relative mx-auto grid min-h-[92vh] max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] bg-[#10211e]/80 p-6 text-start text-white shadow-[0_20px_50px_rgba(16,33,30,0.25)] backdrop-blur-md sm:p-8">
            <BrandLockup size="lg" tone="inverse" className="mb-8" />
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/75">
              {t('landing.eyebrow')}
            </p>
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              {t('landing.headlineLine1')}
              <br />
              {t('landing.headlineLine2')}
            </h1>
            <p className="mb-10 max-w-xl text-lg text-white/85 md:text-xl">
              {t('landing.subtitle')}
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row">{actions}</div>
            <StoreBadges className="mt-6" />
            <div className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/20 pt-8">
              <div>
                <p className="text-3xl font-bold">100%</p>
                <p className="mt-1 text-sm text-white/75">{t('landing.statVerified')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold">0</p>
                <p className="mt-1 text-sm text-white/75">{t('landing.statAgentFees')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold">1</p>
                <p className="mt-1 text-sm text-white/75">{t('landing.statCompound')}</p>
              </div>
            </div>
          </div>
          <div className="relative hidden h-[520px] lg:block">
            <div className="absolute end-6 top-0 h-72 w-64 overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <Image
                src="/marketing/compound-courtyard.jpg"
                alt={t('landing.altCourtyard')}
                fill
                sizes="260px"
                className="object-cover"
              />
            </div>
            <div className="absolute bottom-4 start-0 h-56 w-72 overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-4 ring-white/20">
              <Image
                src="/marketing/porch-table.jpg"
                alt={t('landing.altTable')}
                fill
                sizes="290px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-3xl font-bold text-foreground md:text-4xl">{t('landing.lifeTitle')}</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {shots.map((shot) => (
              <figure key={shot.src} className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
                <div className="relative h-64">
                  <Image src={shot.src} alt={shot.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                </div>
                <figcaption className="p-5">
                  <h3 className="text-lg font-semibold text-foreground">{shot.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{shot.body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">{t('landing.versusTitle')}</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{t('landing.versusBody')}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-muted/50 p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('landing.versusChatTitle')}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  <li>{t('landing.versusChat1')}</li>
                  <li>{t('landing.versusChat2')}</li>
                  <li>{t('landing.versusChat3')}</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-primary/20 bg-secondary p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  {t('landing.versusAppTitle')}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  <li>{t('landing.versusApp1')}</li>
                  <li>{t('landing.versusApp2')}</li>
                  <li>{t('landing.versusApp3')}</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="relative min-h-[560px] overflow-hidden rounded-[32px]">
            <Image
              src="/marketing/balcony-phone.jpg"
              alt={t('landing.altBalcony')}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-8 sm:bottom-8">
              <CompoundThread />
            </div>
          </div>
        </div>
      </section>

      <section className="relative h-80 overflow-hidden">
        <Image
          src="/marketing/compound-courtyard.jpg"
          alt={t('landing.altCourtyard')}
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#10211e]/78" />
        <div className="relative flex h-full items-end px-4 py-10 sm:px-6">
          <p className="mx-auto max-w-3xl text-3xl font-semibold text-white md:text-5xl">
            {t('landing.shotCourtyardBody')}
          </p>
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
                <Card key={feature.title} className="eljiran-card border-border/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(21,128,116,0.12)]">
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
        <div className="container mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="relative h-80 overflow-hidden rounded-[28px] lg:h-full lg:min-h-[420px]">
            <Image
              src="/marketing/porch-table.jpg"
              alt={t('landing.altTable')}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">{t('landing.howTitle')}</h2>
            <p className="mb-8 max-w-xl text-muted-foreground">{t('landing.howSubtitle')}</p>
            <div className="grid gap-6 sm:grid-cols-2">
              {steps.map((step) => (
                <div key={step.number}>
                  <p className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                    {step.number}
                  </p>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2">
          <Card className="eljiran-card">
            <CardContent className="p-8">
              <h3 className="mb-6 text-2xl font-bold text-foreground">{t('landing.whyTitle')}</h3>
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
          <div className="relative h-72 overflow-hidden rounded-[28px] lg:h-full lg:min-h-[280px]">
            <Image
              src="/marketing/compound-street.jpg"
              alt={t('landing.altStreet')}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[center_30%]"
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-24">
        <Image
          src="/marketing/balcony-phone.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#0c4a45]/92" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
            {t('landing.ctaTitle')}
          </h2>
          <p className="mb-8 text-primary-foreground/90">{t('landing.ctaSubtitle')}</p>
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
                  className="border-white bg-transparent text-white hover:bg-white/15"
                >
                  {t('landing.signIn')}
                </Button>
              </Link>
            </div>
          )}
          <StoreBadges align="center" className="mt-8" />
        </div>
      </section>

      <div className="border-t border-border bg-background px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          <SiteFooter />
        </div>
      </div>
    </main>
  )
}
