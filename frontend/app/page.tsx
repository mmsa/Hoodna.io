'use client'

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
  Sparkles,
  Lock,
  TrendingUp,
  Heart,
  Zap
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function Home() {
  const { isAuthenticated } = useAuth()

  const features = [
    {
      icon: Shield,
      title: 'Verified Community',
      description: 'All residents are verified with ID and residency documents for a safe, trusted community.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: ShoppingBag,
      title: 'Compound Marketplace',
      description: 'Buy, sell, and rent within your compound or promote listings to reach a wider audience.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Users,
      title: 'No Agents',
      description: 'Direct communication between verified residents. No middlemen, no fees (except promotions).',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: MessageCircle,
      title: 'Community Feed',
      description: 'Connect with neighbors, share updates, and build relationships within your compound.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: Lock,
      title: 'Secure & Private',
      description: 'Your data is protected. Only verified residents can access your compound community.',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      icon: TrendingUp,
      title: 'Promote Listings',
      description: 'Reach beyond your compound with paid promotions to cross-compound or public feeds.',
      color: 'from-yellow-500 to-orange-500'
    }
  ]

  const steps = [
    {
      number: '01',
      title: 'Sign Up & Select Compound',
      description: 'Create your account and choose your compound or neighborhood.'
    },
    {
      number: '02',
      title: 'Get Verified',
      description: 'Upload your National ID and residency documents for verification.'
    },
    {
      number: '03',
      title: 'Join the Community',
      description: 'Start posting, commenting, and connecting with your verified neighbors.'
    },
    {
      number: '04',
      title: 'Buy & Sell Safely',
      description: 'Create listings or browse the marketplace within your trusted community.'
    }
  ]

  const benefits = [
    { icon: CheckCircle, text: '100% Verified Residents' },
    { icon: CheckCircle, text: 'No Agent Fees' },
    { icon: CheckCircle, text: 'Secure Transactions' },
    { icon: CheckCircle, text: 'Direct Communication' },
    { icon: CheckCircle, text: 'Compound-Specific Content' },
    { icon: CheckCircle, text: 'AI-Powered Verification' }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Verified Neighborhood Community</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
              Your Compound,<br />Your Community
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect with verified neighbors, buy and sell safely, and build a thriving community within your compound.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              {isAuthenticated ? (
                <>
                  <Link href="/feed">
                    <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 px-8 py-6 text-lg">
                      Go to Feed
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button size="lg" variant="outline" className="border-2 px-8 py-6 text-lg">
                      Browse Marketplace
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signup">
                    <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 px-8 py-6 text-lg">
                      Get Started Free
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/auth/login">
                    <Button size="lg" variant="outline" className="border-2 px-8 py-6 text-lg">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8 border-t">
              <div>
                <div className="text-3xl font-bold text-blue-600">100%</div>
                <div className="text-sm text-gray-600 mt-1">Verified</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">0%</div>
                <div className="text-sm text-gray-600 mt-1">Agent Fees</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-pink-600">∞</div>
                <div className="text-sm text-gray-600 mt-1">Possibilities</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A complete platform for your compound community
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card 
                  key={index} 
                  className="border-2 hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in just a few simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="text-6xl font-bold text-blue-200 mb-4">{step.number}</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-1/2 h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 -z-10"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Why Choose Hoodna.io?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                We've built the platform with your safety and convenience in mind.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{benefit.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="relative animate-fade-in">
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 shadow-2xl">
                <div className="bg-white rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      A
                    </div>
                    <div>
                      <div className="font-semibold">Ahmed Mohamed</div>
                      <div className="text-sm text-gray-500">Tagamoa New Cairo</div>
                    </div>
                  </div>
                  <p className="text-gray-700 italic">
                    "Hoodna.io made it so easy to connect with my neighbors and sell my furniture. The verification process gave me confidence that I'm dealing with real residents."
                  </p>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Heart key={i} className="w-4 h-4 fill-red-500 text-red-500" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Join Your Community?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Start connecting with verified neighbors today. It's free to join and takes less than 5 minutes.
            </p>
            {!isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/signup">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 shadow-xl px-8 py-6 text-lg font-semibold">
                    Get Started Free
                    <Zap className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
            {isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/feed">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 shadow-xl px-8 py-6 text-lg font-semibold">
                    Go to Feed
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/marketplace">
                  <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                    Browse Marketplace
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

