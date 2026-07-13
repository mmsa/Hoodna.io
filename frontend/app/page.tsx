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
import { formatCompoundName } from '@/lib/format-compound'

const features = [
  {
    icon: Shield,
    title: 'Verified community',
    description:
      'Residents are verified with ID and residency documents for a trusted neighbourhood.',
  },
  {
    icon: ShoppingBag,
    title: 'Neighbourhood marketplace',
    description:
      'Buy, sell, and rent within your compound — or promote listings to reach more people.',
  },
  {
    icon: Users,
    title: 'No agents',
    description:
      'Direct communication between verified neighbours. No middlemen, no hidden fees.',
  },
  {
    icon: MessageCircle,
    title: 'Community feed',
    description:
      'Share updates, ask for help, and stay connected with people who actually live nearby.',
  },
  {
    icon: Lock,
    title: 'Secure & private',
    description:
      'Your data stays protected. Only verified residents access your neighbourhood space.',
  },
  {
    icon: TrendingUp,
    title: 'Promote listings',
    description:
      'Reach beyond your compound with paid promotions to cross-compound or public feeds.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Sign up & pick your compound',
    description: 'Create your account and choose your neighbourhood.',
  },
  {
    number: '02',
    title: 'Get verified',
    description: 'Upload your National ID and residency documents for review.',
  },
  {
    number: '03',
    title: 'Join the community',
    description: 'Post updates, comment, and connect with verified neighbours.',
  },
  {
    number: '04',
    title: 'Buy & sell safely',
    description: 'List items or browse the marketplace within your trusted community.',
  },
]

const benefits = [
  '100% verified residents',
  'No agent fees',
  'Secure transactions',
  'Direct communication',
  'Compound-specific content',
  'AI-assisted verification',
]

export default function Home() {
  const { isAuthenticated } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border/70 px-4 py-20 md:py-28">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">
            Verified neighbourhood community
          </p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Your neighbourhood,
            <br />
            connected.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Connect with verified neighbours, buy and sell safely, and keep community life organised —
            like a WhatsApp group, but built for your compound.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {mounted && isAuthenticated ? (
              <>
                <Link href="/feed">
                  <Button size="lg" className="min-w-[180px]">
                    Go to feed
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/marketplace">
                  <Button size="lg" variant="outline" className="min-w-[180px]">
                    Browse marketplace
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/signup">
                  <Button size="lg" className="min-w-[180px]">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="min-w-[180px]">
                    Sign in
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-border pt-10">
            <div>
              <p className="text-3xl font-bold text-primary">100%</p>
              <p className="mt-1 text-sm text-muted-foreground">Verified</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">0</p>
              <p className="mt-1 text-sm text-muted-foreground">Agent fees</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">1</p>
              <p className="mt-1 text-sm text-muted-foreground">Your compound</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Everything your neighbourhood needs
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Feed, marketplace, services, and verification — in one calm place.
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
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Get started in a few simple steps.
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
                Why neighbours choose Eljiran
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
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">From real compounds</h2>
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
            Ready to join your community?
          </h2>
          <p className="mb-8 text-primary-foreground/90">
            Free to join. Verified neighbours only.
          </p>
          {mounted && isAuthenticated ? (
            <Link href="/feed">
              <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                Go to feed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/signup">
                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                  Get started
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
