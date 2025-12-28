'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  User
} from 'lucide-react'

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
    <Link href={`/listing/${listing.id}`}>
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
  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ['listings', 'compound'],
    queryFn: async () => {
      const response = await api.get('/api/listings?scope=compound')
      return response.data
    },
  })

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
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Marketplace
              </h1>
              <p className="text-gray-600 text-lg">
                Buy, sell, and rent within your compound community
              </p>
            </div>
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
          
          {/* Stats */}
          {listings && listings.length > 0 && (
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{listings.length}</span>
              <span>Active Listings</span>
            </div>
          )}
        </div>

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
                No listings yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Be the first to list something for sale or rent in your compound!
              </p>
              <Link href="/marketplace/new">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Listing
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

