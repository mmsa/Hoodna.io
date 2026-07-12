'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Rating } from '@/components/ui/rating'
import { Wrench, Star, Search, ArrowRight, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { formatCompoundName } from '@/lib/format-compound'

interface Listing {
  id: number
  title: string
  description: string
  price: number
  category: string
  intent: string
  image_urls: string[]
  created_at: string
  average_rating?: number | null
  review_count?: number
}

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

export default function ServicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')

  // Check if user is a service provider and fetch their profile
  const { data: providerProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['provider-profile'],
    queryFn: async () => {
      if (user?.role !== 'SERVICE_PROVIDER') return null
      try {
        const response = await api.get('/api/providers/me')
        return response.data
      } catch {
        return null
      }
    },
    enabled: !!user && user.role === 'SERVICE_PROVIDER',
    retry: false,
  })

  // Redirect service providers to status page if not approved
  useEffect(() => {
    if (user?.role === 'SERVICE_PROVIDER') {
      // Wait for profile to load
      if (isLoadingProfile) {
        return
      }
      
      if (!providerProfile) {
        // Profile doesn't exist, redirect to status page
        router.push('/provider/status')
        return
      }
      
      const status = providerProfile.provider_status?.toString().trim().toUpperCase()
      
      // Only redirect if NOT approved
      if (status !== 'APPROVED') {
        router.push('/provider/status')
        return
      }
      // If approved, allow access to services page
    }
  }, [user, providerProfile, isLoadingProfile, router])

  // Fetch feed summary to get compound name (only for residents, not service providers)
  const { data: feedSummary } = useQuery({
    queryKey: ['feed-summary'],
    queryFn: async () => {
      const response = await api.get('/api/feed/summary')
      return response.data
    },
    enabled: !!user && user.role !== 'SERVICE_PROVIDER' && user.role !== 'COMPOUND_MOD',
    retry: false,
  })

  const compoundName = feedSummary?.compound_name 
    ? formatCompoundName(feedSummary.compound_name) 
    : 'your compound'

  // Determine scope: use 'my' for service providers, 'compound' for residents
  const scope = useMemo(() => {
    // For service providers, always use 'my' scope (don't wait for profile status)
    if (user?.role === 'SERVICE_PROVIDER') {
      return 'my'
    }
    return 'compound'
  }, [user?.role])

  const queryParams = useMemo(() => {
    // Ensure scope is correct for service providers
    const finalScope = user?.role === 'SERVICE_PROVIDER' ? 'my' : scope
    const params: Record<string, string> = {
      scope: finalScope,
      category: 'SERVICE', // Only services
      sort_by: sortBy,
    }
    
    if (searchQuery.trim()) {
      params.search = searchQuery.trim()
    }
    
    return params
  }, [scope, searchQuery, sortBy, user?.role])

  const { data: services, isLoading, error } = useQuery<Listing[]>({
    queryKey: ['services', user?.role, scope, queryParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(queryParams).toString()
      const response = await api.get(`/api/listings?${queryString}`)
      return response.data || []
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: (() => {
      // Always wait for user to be loaded to determine correct scope
      if (!user) {
        return false
      }
      
      // For service providers, wait for profile to load and check if approved
      if (user.role === 'SERVICE_PROVIDER') {
        // Wait for profile to finish loading
        if (isLoadingProfile) {
          return false
        }
        
        // If no profile or not approved, don't enable query (will redirect)
        if (!providerProfile || providerProfile.provider_status !== 'APPROVED') {
          return false
        }
        
        return true
      }
      // For other users, enable immediately
      return true
    })(),
  })

  useEffect(() => {
    if (!error) return

    const status = (error as any).response?.status

    if (status === 403) {
      router.push('/verification')
      return
    }

    if (status === 400) {
      if (user?.role === 'SERVICE_PROVIDER') {
        router.push('/provider/status')
      }
    }
  }, [error, router, user])

  // Show loading state while checking provider profile
  if (isLoading || (user?.role === 'SERVICE_PROVIDER' && isLoadingProfile)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {user?.role === 'SERVICE_PROVIDER' ? 'My Services' : 'Services'}
              </h1>
              <p className="text-gray-600">
                {user?.role === 'SERVICE_PROVIDER' 
                  ? 'Manage your service listings' 
                  : `Find verified service providers in ${compoundName}`}
              </p>
            </div>
            {user?.role === 'SERVICE_PROVIDER' && providerProfile?.provider_status === 'APPROVED' && (
              <Link href="/marketplace/new?category=SERVICE">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Wrench className="w-4 h-4 mr-2" />
                  Add New Service
                </Button>
              </Link>
            )}
          </div>

          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {SORT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={sortBy === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(option.value)}
                  className="whitespace-nowrap"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Services Grid */}
        {services && services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Link key={service.id} href={`/listing/${service.id}`}>
                <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-green-100 hover:border-green-300">
                  {service.image_urls && service.image_urls.length > 0 ? (
                    <div className="relative h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={service.image_urls[0]}
                        alt={service.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center rounded-t-lg">
                      <Wrench className="w-16 h-16 text-green-400" />
                    </div>
                  )}
                  <CardContent className="p-5">
                    {/* Service Provider Badge */}
                    <Badge className="mb-3 bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Service Provider
                    </Badge>

                    <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                      {service.title}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {service.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        {service.price && (
                          <>
                            <p className="text-2xl font-bold text-green-600">
                              {service.price.toLocaleString()} EGP
                            </p>
                            <p className="text-xs text-gray-500">
                              {service.intent === 'RENT' ? 'per hour' : 'one-time'}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Rating */}
                      {service.average_rating ? (
                        <div className="flex items-center gap-2">
                          <Rating rating={service.average_rating} size="sm" showValue />
                          <span className="text-xs text-gray-500">
                            ({service.review_count || 0})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                          <Star className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-600">No reviews</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-12 text-center">
              <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No services yet
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery.trim()
                  ? 'No services match your search'
                  : `Be the first to offer a service in ${compoundName}!`}
              </p>
              {user?.role === 'SERVICE_PROVIDER' && providerProfile?.provider_status === 'APPROVED' && (
                <Link href="/marketplace/new?category=SERVICE">
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Wrench className="w-4 h-4 mr-2" />
                    Add Your First Service
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
