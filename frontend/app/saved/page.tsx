'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import Link from 'next/link'
import {
  Bookmark,
  Heart,
  ShoppingBag,
  Home as HomeIcon,
  Car,
  Package,
  Wrench,
  ArrowRight,
  MapPin,
  User,
  Calendar,
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
    case 'PROPERTY':
      return <HomeIcon className="w-4 h-4" />
    case 'CAR':
      return <Car className="w-4 h-4" />
    case 'ITEM':
      return <Package className="w-4 h-4" />
    case 'SERVICE':
      return <Wrench className="w-4 h-4" />
    default:
      return <ShoppingBag className="w-4 h-4" />
  }
}

const getCategoryColor = (category: string) => {
  switch (category.toUpperCase()) {
    case 'PROPERTY':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'CAR':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'ITEM':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'SERVICE':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export default function SavedListingsPage() {
  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ['saved-listings'],
    queryFn: async () => {
      const response = await api.get('/api/saved-listings')
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading saved listings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-600 mb-4 shadow-lg">
            <Bookmark className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Saved Listings
          </h1>
          <p className="text-gray-600">
            Your bookmarked listings for easy access
          </p>
        </div>

        {/* Listings Grid */}
        {listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Link href={`/listing/${listing.id}`} key={listing.id}>
                <Card className="overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group">
                  <div className="relative h-48 w-full">
                    {listing.image_urls && listing.image_urls.length > 0 ? (
                      <img
                        src={listing.image_urls[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                        <ShoppingBag className="w-16 h-16 text-gray-400 opacity-50" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <Heart className="w-5 h-5 text-white fill-current" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(
                          listing.category
                        )}`}
                      >
                        <span className="flex items-center gap-1">
                          {getCategoryIcon(listing.category)}
                          {listing.category}
                        </span>
                      </span>
                    </div>
                    {listing.intent && (
                      <div className="absolute bottom-3 left-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            listing.intent === 'SELL'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {listing.intent === 'SELL' ? 'For Sale' : 'For Rent'}
                        </span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {listing.title}
                    </h3>
                    {listing.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {listing.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                          {listing.price} {listing.currency}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{listing.compound_name}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="shadow-lg border-2 border-dashed border-gray-300 bg-white">
            <CardContent className="p-12 text-center">
              <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No saved listings yet
              </h3>
              <p className="text-gray-500 mb-4">
                Start saving listings you're interested in by clicking the "Save" button on any listing.
              </p>
              <Link href="/marketplace">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600">
                  Browse Marketplace
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

