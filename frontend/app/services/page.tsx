'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Wrench, Star, Search, ArrowRight, CheckCircle, Info } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'

interface Listing {
  id: number
  title: string
  description: string
  price: number
  category: string
  intent: string
  image_urls: string[]
  created_at: string
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

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      scope: 'compound',
      category: 'SERVICE', // Only services
      sort_by: sortBy,
    }
    
    if (searchQuery.trim()) {
      params.search = searchQuery.trim()
    }
    
    return params
  }, [searchQuery, sortBy])

  const { data: services, isLoading, error } = useQuery<Listing[]>({
    queryKey: ['services', 'compound', queryParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(queryParams).toString()
      const response = await api.get(`/api/listings?${queryString}`)
      return response.data || []
    },
    onError: (error: any) => {
      // Redirect to verification if user is not verified for compound
      if (error?.response?.status === 403) {
        router.push('/verification')
      }
    },
  })

  if (isLoading) {
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Services</h1>
              <p className="text-gray-600">
                Find verified service providers in your compound
              </p>
            </div>
            {user?.can_create_listing && (
              <Link href="/marketplace/new?category=SERVICE">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Wrench className="w-4 h-4 mr-2" />
                  Offer Service
                </Button>
              </Link>
            )}
          </div>

          {/* Info Banner */}
          <Card className="bg-yellow-50 border-yellow-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 mb-1">
                    Verified Service Providers
                  </p>
                  <p className="text-sm text-yellow-800">
                    All services are from verified neighbors in your compound. Ratings and reviews coming soon!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
              <Link key={service.id} href={`/marketplace/${service.id}`}>
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

                      {/* Rating Placeholder */}
                      <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1.5 rounded-full">
                        <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                        <span className="text-sm font-semibold text-yellow-800">New</span>
                      </div>
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
                  : 'Be the first to offer a service in your compound!'}
              </p>
              {user?.can_create_listing && (
                <Link href="/marketplace/new?category=SERVICE">
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Wrench className="w-4 h-4 mr-2" />
                    Offer Your First Service
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

