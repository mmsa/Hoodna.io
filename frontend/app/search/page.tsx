'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  MessageSquare, 
  ShoppingBag, 
  Wrench, 
  User, 
  Home,
  ArrowRight,
  Clock,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { formatTimeAgo } from '@/lib/utils'
import { track } from '@/lib/telemetry'

interface SearchResult {
  type: 'post' | 'listing' | 'service' | 'business'
  id: number
  title: string
  content?: string
  author_name?: string
  compound_name?: string
  category?: string
  price?: number
  created_at?: string
  slug?: string
}

interface SearchResponse {
  query: string
  posts: SearchResult[]
  listings: SearchResult[]
  services: SearchResult[]
  total_results: number
}

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState(searchParams?.get?.('q') || '')
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      if (searchQuery.trim()) {
        router.replace(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, router])

  const { data: searchResults, isLoading } = useQuery<SearchResponse>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return { query: '', posts: [], listings: [], services: [], total_results: 0 }
      }
      const response = await api.get(`/api/search/global?q=${encodeURIComponent(debouncedQuery.trim())}`)
      track('search_performed', {
        result_count: response.data.total_results,
        source_screen: 'global_search',
      })
      return response.data
    },
    enabled: debouncedQuery.trim().length > 0 && !!user?.compound_id,
  })

  const { data: businessResults } = useQuery({
    queryKey: ['business-search', debouncedQuery],
    queryFn: async () => {
      const response = await api.get(`/api/businesses?search=${encodeURIComponent(debouncedQuery.trim())}&limit=10`)
      return response.data.items || []
    },
    enabled: debouncedQuery.trim().length > 0,
    retry: false,
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'post':
        return MessageSquare
      case 'listing':
        return ShoppingBag
      case 'service':
        return Wrench
      case 'business':
        return Home
      default:
        return Search
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'post':
        return 'bg-secondary text-primary border-border'
      case 'listing':
        return 'bg-secondary text-primary border-border'
      case 'service':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'business':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'post':
        return 'Post'
      case 'listing':
        return 'Marketplace'
      case 'service':
        return 'Service'
      case 'business':
        return 'Business'
      default:
        return 'Result'
    }
  }

  const getResultUrl = (result: SearchResult) => {
    switch (result.type) {
      case 'post':
        return `/feed#post-${result.id}`
      case 'listing':
        return `/marketplace/${result.id}`
      case 'service':
        return `/marketplace/${result.id}`
      case 'business':
        return `/businesses/${encodeURIComponent(result.slug || String(result.id))}`
      default:
        return '/'
    }
  }

  const allResults = [
    ...(searchResults?.posts || []).map(r => ({ ...r, type: 'post' as const })),
    ...(searchResults?.listings || []).map(r => ({ ...r, type: 'listing' as const })),
    ...(searchResults?.services || []).map(r => ({ ...r, type: 'service' as const })),
    ...(businessResults || []).map((business: any) => ({
      type: 'business' as const,
      id: business.id,
      slug: business.slug,
      title: business.name,
      content: [business.area, business.city].filter(Boolean).join(', '),
      category: business.category,
    })),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Search</h1>
          <p className="text-gray-600">
            Find posts, marketplace items, and services across your compound
          </p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search posts, listings, services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 h-14 text-lg"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        {isLoading && debouncedQuery.trim() && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Searching...</p>
          </div>
        )}

        {!isLoading && debouncedQuery.trim() && searchResults && (
          <>
            {/* Results Summary */}
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold text-gray-900">{searchResults.total_results}</span> result{searchResults.total_results !== 1 ? 's' : ''} for "{debouncedQuery}"
              </p>
            </div>

            {allResults.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="p-12 text-center">
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No results found
                  </h3>
                  <p className="text-gray-600">
                    Try different keywords or check your spelling
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {allResults.map((result) => {
                  const IconComponent = getTypeIcon(result.type)
                  return (
                    <Link key={`${result.type}-${result.id}`} href={getResultUrl(result)} onClick={() => track('search_result_opened', { entity_type: result.type, entity_id: result.id, source_screen: 'global_search' })}>
                      <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/30">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeColor(result.type)}`}>
                              <IconComponent className="w-6 h-6" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getTypeColor(result.type)}>
                                  {getTypeLabel(result.type)}
                                </Badge>
                                {result.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {result.category.replace('_', ' ')}
                                  </Badge>
                                )}
                                {result.compound_name && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Home className="w-3 h-3" />
                                    {result.compound_name}
                                  </div>
                                )}
                              </div>

                              <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-1">
                                {result.title}
                              </h3>

                              {result.content && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                  {result.content}
                                </p>
                              )}

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  {result.author_name && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>{result.author_name}</span>
                                    </div>
                                  )}
                                  {result.created_at ? <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatTimeAgo(result.created_at)}</span>
                                  </div> : null}
                                </div>

                                {result.price && (
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-green-600">
                                      {result.price.toLocaleString()} EGP
                                    </p>
                                  </div>
                                )}

                                <ArrowRight className="w-5 h-5 text-gray-400" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}

        {!debouncedQuery.trim() && (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-12 text-center">
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Start searching
              </h3>
              <p className="text-gray-600 mb-6">
                Search across posts, marketplace items, and services in your compound
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge className="bg-secondary text-primary">Posts</Badge>
                <Badge className="bg-secondary text-primary">Marketplace</Badge>
                <Badge className="bg-green-100 text-green-800">Services</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
