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
import { formatCompoundName } from '@/lib/format-compound'

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
      title: 'Neighbourhood Marketplace',
      description: 'Buy, sell, and rent within your neighbourhood or promote listings to reach a wider audience.',
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
      description: 'Connect with neighbors, share updates, and build relationships within your neighbourhood.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: Lock,
      title: 'Secure & Private',
      description: 'Your data is protected. Only verified residents can access your neighbourhood community.',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      icon: TrendingUp,
      title: 'Promote Listings',
      description: 'Reach beyond your neighbourhood with paid promotions to cross-compound or public feeds.',
      color: 'from-yellow-500 to-orange-500'
    }
  ]

  const steps = [
    {
      number: '01',
      title: 'Sign Up & Select Neighbourhood',
      description: 'Create your account and choose your compound or neighbourhood.'
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
    { icon: CheckCircle, text: 'Neighbourhood-Specific Content' },
    { icon: CheckCircle, text: 'AI-Powered Verification' }
  ]

  return (
    <main className="min-h-screen bg-gradient-soft">
      {/* Hero Section - More Emotional & Engaging */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center max-w-4xl mx-auto animate-slide-up">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full text-indigo-700 text-sm font-semibold mb-8 shadow-lg hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>✨ Verified Neighborhood Community</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold mb-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight tracking-tight">
              Your Neighbourhood,<br />
              <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Your Community
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl lg:text-3xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
              Connect with verified neighbors, buy and sell safely, and build a thriving community within your neighbourhood. 
              <span className="text-indigo-600 font-semibold"> No agents. No fees. Just real connections.</span> 💫
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-16">
              {isAuthenticated ? (
                <>
                  <Link href="/feed">
                    <Button size="lg" className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 px-10 py-7 text-lg font-bold rounded-2xl group">
                      <span className="flex items-center gap-2">
                        Go to Feed
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button size="lg" variant="outline" className="border-3 border-indigo-300 hover:border-indigo-500 px-10 py-7 text-lg font-semibold rounded-2xl hover:bg-indigo-50 transition-all duration-300 hover:scale-105">
                      Browse Marketplace 🛒
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signup">
                    <Button size="lg" className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 px-10 py-7 text-lg font-bold rounded-2xl group animate-pulse-glow">
                      <span className="flex items-center gap-2">
                        Get Started Free 🚀
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Button>
                  </Link>
                  <Link href="/auth/login">
                    <Button size="lg" variant="outline" className="border-3 border-indigo-300 hover:border-indigo-500 px-10 py-7 text-lg font-semibold rounded-2xl hover:bg-indigo-50 transition-all duration-300 hover:scale-105">
                      Sign In ✨
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Stats - More Engaging */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto pt-12 border-t-2 border-indigo-200">
              <div className="group hover:scale-110 transition-transform duration-300 cursor-default">
                <div className="text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  100%
                </div>
                <div className="text-base font-semibold text-slate-700">Verified ✨</div>
                <div className="text-xs text-slate-500 mt-1">All neighbors checked</div>
              </div>
              <div className="group hover:scale-110 transition-transform duration-300 cursor-default">
                <div className="text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  $0
                </div>
                <div className="text-base font-semibold text-slate-700">Agent Fees 💰</div>
                <div className="text-xs text-slate-500 mt-1">Direct deals only</div>
              </div>
              <div className="group hover:scale-110 transition-transform duration-300 cursor-default">
                <div className="text-5xl font-extrabold bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  ∞
                </div>
                <div className="text-base font-semibold text-slate-700">Possibilities 🎯</div>
                <div className="text-xs text-slate-500 mt-1">Endless connections</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - More Engaging */}
      <section className="py-24 px-4 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-pink-50/50"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-20 animate-slide-up">
            <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 bg-clip-text text-transparent">
              Everything You Need 🎁
            </h2>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto font-medium">
              A complete platform designed for your neighbourhood community. 
              <span className="text-indigo-600 font-semibold"> Built with love, powered by trust.</span> 💙
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card 
                  key={index} 
                  className="border-2 border-slate-200 hover:border-indigo-300 hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-2 animate-fade-in group bg-white/80 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-8">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-base">{feature.description}</p>
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

      {/* Trust & Social Proof Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-4">
              <Shield className="w-4 h-4" />
              <span>Verified Residents Only</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Trust & Safety First
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Every member is verified with ID and residency documents. No bots, no scams, just real neighbors.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white rounded-xl p-6 shadow-lg text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">100% Verified</h3>
              <p className="text-gray-600">Every user verified with National ID and residency documents</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg text-center animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
              <p className="text-gray-600">Your data is protected. Only verified residents can access your neighbourhood</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg text-center animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">No Agents</h3>
              <p className="text-gray-600">Direct communication between verified residents. No middlemen, no hidden fees</p>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why Choose eljiran.com?</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon
                return (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-gray-700 font-medium">{benefit.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Loved by Residents
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See what your neighbors are saying about eljiran.com
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Ahmed Mohamed",
                compound: formatCompoundName("Tagamoa New Cairo"),
                text: "eljiran.com made it so easy to connect with my neighbors and sell my furniture. The verification process gave me confidence that I'm dealing with real residents.",
                rating: 5
              },
              {
                name: "Sara Ali",
                compound: formatCompoundName("Zayed"),
                text: "Finally, a marketplace without agents! I sold my car directly to a neighbor in my neighbourhood. The whole process was smooth and secure.",
                rating: 5
              },
              {
                name: "Mohamed Hassan",
                compound: formatCompoundName("New Capital"),
                text: "The community feed is amazing. I've made so many connections and found great deals on items I needed. Highly recommend!",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 shadow-lg animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.compound}</div>
                  </div>
                </div>
                <p className="text-gray-700 mb-4 italic">"{testimonial.text}"</p>
                <div className="flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Heart key={i} className="w-4 h-4 fill-red-500 text-red-500" />
                  ))}
                </div>
              </div>
            ))}
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

