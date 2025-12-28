'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case "CAR":
      return 'bg-red-100 text-red-700 border-red-200'
    case "ITEM":
      return 'bg-green-100 text-green-700 border-green-200'
    case "SERVICE":
      return 'bg-purple-100 text-purple-700 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
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

export default function SavedListingsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ['saved-listings'],
    queryFn: async () => {
      const response = await api.get('/api/saved-listings')
      return response.data
    },
  })

  const unsaveMutation = useMutation({
    mutationFn: async (listingId: number) => {
      await api.delete(`/api/listings/${listingId}/save`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-listings'] })
      toast({
        title: 'Removed from saved',
        description: 'Listing removed from your saved list',
        variant: 'success',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to remove listing',
        variant: 'destructive',
      })
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
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Bookmark className="w-7 h-7 text-white fill-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-2">
                Saved Listings
              </h1>
              <p className="text-gray-600">
                Your bookmarked listings for easy access
              </p>
            </div>
          </div>

          {/* Stats Card */}
          {listings && listings.length > 0 && (
            <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white max-w-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Saved</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {listings.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Listings Grid */}
        {listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Card
                key={listing.id}
                className="overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group border-2 border-gray-200 bg-white"
              >
                <Link href={`/listing/${listing.id}`}>
                  <div className="relative h-48 w-full">
                    {listing.image_urls && listing.image_urls.length > 0 ? (
                      <img
                        src={listing.image_urls[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getCategoryGradient(listing.category)} flex items-center justify-center`}>
                        <ShoppingBag className="w-16 h-16 text-white opacity-30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    
                    {/* Saved Badge */}
                    <div className="absolute top-3 right-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg">
                        <Heart className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                    
                    {/* Category Badge */}
                    <div className="absolute top-3 left-3">
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
                      <div className="absolute bottom-3 left-3">
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
                </Link>

                <CardContent className="p-5">
                  <Link href={`/listing/${listing.id}`}>
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
                  </Link>

                  {/* Unsave Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.preventDefault()
                      unsaveMutation.mutate(listing.id)
                    }}
                    disabled={unsaveMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove from Saved
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-xl border-2 border-dashed border-gray-300 bg-white">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
                <Bookmark className="w-12 h-12 text-yellow-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                No saved listings yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Start saving listings you're interested in! Click the bookmark icon on any listing to save it for later.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/marketplace">
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Browse Marketplace
                  </Button>
                </Link>
                <Link href="/feed">
                  <Button variant="outline" className="border-2">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Explore Feed
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

