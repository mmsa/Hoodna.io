'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import Link from 'next/link'
import { 
  ShoppingBag, 
  Plus, 
  Home as HomeIcon, 
  Car, 
  Package, 
  Wrench,
  ArrowRight,
  MapPin,
  Calendar,
  User,
  Search,
  Filter,
  X,
  SlidersHorizontal,
  MessageCircle,
  Bookmark,
  Bell,
  TrendingUp
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { formatCompoundName } from '@/lib/format-compound'

interface Listing {
  id: number
  title: string
  description: string
  price: number
  currency: string
  category: string
  intent: string
  image_urls: string[]
  compound_name: string
  owner_name: string
  created_at: string
}

const CATEGORIES = [
  { value: '', label: 'All Categories', icon: ShoppingBag },
  { value: 'PROPERTY', label: 'Property', icon: HomeIcon },
  { value: 'CAR', label: 'Cars', icon: Car },
  { value: 'ITEM', label: 'Items', icon: Package },
  // SERVICE removed - now has dedicated Services page
]

const INTENTS = [
  { value: '', label: 'All Types' },
  { value: 'SELL', label: 'For Sale' },
  { value: 'RENT', label: 'For Rent' },
]

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

const getCategoryIcon = (category: string) => {
  switch (category.toUpperCase()) {
    case "PROPERTY":
      return <HomeIcon className="w-4 h-4" />
    case "CAR":
      return <Car className="w-4 h-4" />
    case "ITEM":
      return <Package className="w-4 h-4" />
    case "SERVICE":
      return <Wrench className="w-4 h-4" />
    default:
      return <ShoppingBag className="w-4 h-4" />
  }
}

const getCategoryColor = (category: string) => {
  switch (category.toUpperCase()) {
    case "PROPERTY":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "CAR":
      return "bg-red-100 text-red-700 border-red-200"
    case "ITEM":
      return "bg-green-100 text-green-700 border-green-200"
    case "SERVICE":
      return "bg-purple-100 text-purple-700 border-purple-200"
    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}

const getCategoryGradient = (category: string) => {
  switch (category.toUpperCase()) {
    case "PROPERTY":
      return "from-blue-400 to-blue-600"
    case "CAR":
      return "from-red-400 to-red-600"
    case "ITEM":
      return "from-green-400 to-green-600"
    case "SERVICE":
      return "from-purple-400 to-purple-600"
    default:
      return "from-gray-400 to-gray-600"
  }
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/marketplace/${listing.id}`}>
      <Card className="shadow-lg border-2 border-gray-200 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group bg-white overflow-hidden">
        <div className="relative">
          {listing.image_urls && listing.image_urls.length > 0 ? (
            <div className="relative w-full h-56 overflow-hidden">
              <img
                src={listing.image_urls[0]}
                alt={listing.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          ) : (
            <div className={`w-full h-56 bg-gradient-to-br ${getCategoryGradient(listing.category)} flex items-center justify-center relative`}>
              <ShoppingBag className="w-20 h-20 text-white opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          )}
          
          {/* Category Badge */}
          <div className="absolute top-3 right-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 backdrop-blur-sm bg-white/90 ${getCategoryColor(
                listing.category
              )}`}
            >
              <span className="flex items-center gap-1.5">
                {getCategoryIcon(listing.category)}
                {listing.category}
              </span>
            </span>
          </div>
          
          {/* Intent Badge */}
          {listing.intent && (
            <div className="absolute top-3 left-3">
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
                  listing.intent === "SELL"
                    ? "bg-red-500/90 text-white border-2 border-red-600"
                    : "bg-blue-500/90 text-white border-2 border-blue-600"
                }`}
              >
                {listing.intent === "SELL" ? "For Sale" : "For Rent"}
              </span>
            </div>
          )}
        </div>
        
        <CardContent className="p-5">
          <h3 className="font-bold text-lg mb-2 text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {listing.title}
          </h3>
          
          {listing.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
              {listing.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            {listing.compound_name && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {listing.compound_name}
              </span>
            )}
            {listing.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(listing.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex-1">
              <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {listing.price.toLocaleString()} {listing.currency}
              </p>
              {listing.owner_name && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {listing.owner_name}
                </p>
              )}
            </div>
            <div className="ml-4 p-2 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
              <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function MarketplacePage() {
  const { user, isLoading: userLoading } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedIntent, setSelectedIntent] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Block moderators from accessing marketplace
  if (!userLoading && user && user.role === 'COMPOUND_MOD') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-32 h-32 mx-auto mb-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-6xl">🚫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Access Restricted
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Moderators are not allowed to browse the marketplace. Please manage content from the Feed or Moderation Dashboard.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/feed">
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                Go to Feed
              </Button>
            </Link>
            <Link href="/moderator/dashboard">
              <Button variant="outline" className="px-8 py-6 text-lg font-semibold rounded-xl">
                Moderation Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Block SERVICE_PROVIDER users from accessing the marketplace
  if (user && user.role === "SERVICE_PROVIDER") {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-32 h-32 mx-auto mb-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-6xl">🚫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Access Restricted
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Service providers are not allowed to browse the marketplace. Please manage your services from the Services page.
          </p>
          <Link href="/services">
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              Go to My Services
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Block REJECTED users from accessing the marketplace
  if (user && user.status === "REJECTED") {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-32 h-32 mx-auto mb-8 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-6xl">🚫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Verification Not Granted
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Your verification request has been rejected. You cannot access the marketplace at this time.
          </p>
          <Link href="/verification">
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              Review Verification Status
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Fetch unread messages count
  const { data: conversations } = useQuery<Array<{ unread_count: number }>>({
    queryKey: ['conversations'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/conversations')
        return response.data || []
      } catch {
        return []
      }
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const unreadMessagesCount = conversations?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0

  // Fetch saved listings count
  const { data: savedListings } = useQuery<Array<{ id: number }>>({
    queryKey: ['saved-listings'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/saved-listings')
        return response.data || []
      } catch {
        return []
      }
    },
    enabled: !!user,
  })

  const savedCount = savedListings?.length || 0

  // Fetch feed summary to get compound name
  const { data: feedSummary } = useQuery({
    queryKey: ['feed-summary'],
    queryFn: async () => {
      const response = await api.get('/api/feed/summary')
      return response.data
    },
    enabled: !!user && user.role !== 'COMPOUND_MOD' && user.role !== 'SERVICE_PROVIDER',
    retry: false,
  })

  const compoundName = feedSummary?.compound_name 
    ? formatCompoundName(feedSummary.compound_name) 
    : 'your compound'

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      scope: 'compound',
      sort_by: sortBy,
    }
    
    if (searchQuery.trim()) {
      params.search = searchQuery.trim()
    }
    if (selectedCategory) {
      params.category = selectedCategory
    }
    if (selectedIntent) {
      params.intent = selectedIntent
    }
    if (minPrice) {
      params.min_price = minPrice
    }
    if (maxPrice) {
      params.max_price = maxPrice
    }
    
    return params
  }, [searchQuery, selectedCategory, selectedIntent, sortBy, minPrice, maxPrice])

  const { data: listings, isLoading, error } = useQuery<Listing[]>({
    queryKey: ['listings', 'compound', queryParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(queryParams).toString()
      const response = await api.get(`/api/listings?${queryString}`)
      // Filter out SERVICES - they have their own page now
      const data = response.data || []
      return data.filter((listing: Listing) => listing.category !== 'SERVICE')
    },
  })

  useEffect(() => {
    if (!error) return

    const status = (error as any)?.response?.status
    if (status !== 403) return

    queryClient.invalidateQueries({ queryKey: ['current-user'] })
    const timeoutId = setTimeout(async () => {
      try {
        const statusResponse = await api.get('/api/verification/status')
        if (statusResponse.data.user_status === 'APPROVED') {
          queryClient.invalidateQueries({ queryKey: ['current-user'] })
          queryClient.invalidateQueries({ queryKey: ['listings'] })
        } else {
          router.push('/verification')
        }
      } catch {
        router.push('/verification')
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [error, queryClient, router])

  const hasActiveFilters = selectedCategory || selectedIntent || minPrice || maxPrice || searchQuery

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedIntent('')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('date_desc')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading marketplace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          {/* Top Section: Title and Actions */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Marketplace
              </h1>
              <p className="text-gray-600 text-lg">
                Buy, sell, and rent within {compoundName}
              </p>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              {/* Messages */}
              {user && (
                <Link href="/messages">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="relative border-2 hover:border-purple-300 hover:bg-purple-50 transition-all"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Messages
                    {unreadMessagesCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </span>
                    )}
                  </Button>
                </Link>
              )}
              
              {/* Saved Items */}
              {user && (
                <Link href="/saved-listings">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="relative border-2 hover:border-yellow-300 hover:bg-yellow-50 transition-all"
                  >
                    <Bookmark className="w-5 h-5 mr-2" />
                    Saved
                    {savedCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
                        {savedCount}
                      </span>
                    )}
                  </Button>
                </Link>
              )}
              
              {/* Create Listing */}
              <Link href="/marketplace/new">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Listing
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Active Listings Card */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Listings</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {listings?.length || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* For Sale Card */}
            <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white hover:shadow-lg transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">For Sale</p>
                    <p className="text-2xl font-bold text-red-600">
                      {listings?.filter(l => l.intent === 'SELL').length || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* For Rent Card */}
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:shadow-lg transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">For Rent</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {listings?.filter(l => l.intent === 'RENT').length || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <HomeIcon className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services Card - Links to Services page */}
            <Link href="/services">
              <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Services</p>
                      <p className="text-lg font-bold text-green-600 flex items-center gap-2">
                        View Services <ArrowRight className="w-4 h-4" />
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Categories */}
          <aside className="lg:w-64 flex-shrink-0">
            <Card className="sticky top-4 border-2 border-gray-200">
              <CardContent className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-purple-600" />
                  Categories
                </h2>
                <div className="space-y-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                          selectedCategory === cat.value
                            ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 font-semibold'
                            : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm">{cat.label}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Type</h3>
                  <div className="space-y-2">
                    {INTENTS.map((intent) => (
                      <button
                        key={intent.value}
                        onClick={() => setSelectedIntent(intent.value)}
                        className={`w-full text-left px-4 py-2 rounded-lg transition-all text-sm ${
                          selectedIntent === intent.value
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 font-semibold'
                            : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {intent.label}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="w-full mt-4"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search and Filters Bar */}
            <Card className="mb-6 border-2 border-gray-200">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="Search listings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 h-11"
                    />
                  </div>

                  {/* Sort */}
                  <div className="md:w-48">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Toggle Filters Button (Mobile) */}
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden"
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                  </Button>
                </div>

                {/* Price Range Filters (Mobile/Expandable) */}
                <div className={`mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4 ${showFilters ? 'block' : 'hidden'} lg:block`}>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Min Price (EGP)
                    </label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Max Price (EGP)
                    </label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Listings Grid */}
            {listings && listings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <Card className="shadow-xl border-2 border-dashed border-gray-300 bg-white">
                <CardContent className="p-12 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="w-12 h-12 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {hasActiveFilters ? 'No listings match your filters' : 'No listings yet'}
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters to see more results.'
                      : `Be the first to list something for sale or rent in ${compoundName}!`}
                  </p>
                  {hasActiveFilters ? (
                    <Button onClick={clearFilters} variant="outline">
                      <X className="w-4 h-4 mr-2" />
                      Clear Filters
                    </Button>
                  ) : (
                    <Link href="/marketplace/new">
                      <Button 
                        size="lg"
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Your First Listing
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
