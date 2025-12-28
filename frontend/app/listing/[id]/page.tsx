'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Home as HomeIcon, 
  Car, 
  Package, 
  Wrench,
  ShoppingBag,
  MapPin,
  User,
  Calendar,
  TrendingUp,
  Share2,
  MessageCircle,
  Mail,
  Phone,
  X,
  Heart,
  Bookmark
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  owner_id: number
  owner_name: string
  owner_email?: string
  owner_phone?: string
  created_at: string
  is_saved?: boolean
}

const getCategoryIcon = (category: string) => {
  switch (category.toUpperCase()) {
    case "PROPERTY":
      return <HomeIcon className="w-5 h-5" />
    case "CAR":
      return <Car className="w-5 h-5" />
    case "ITEM":
      return <Package className="w-5 h-5" />
    case "SERVICE":
      return <Wrench className="w-5 h-5" />
    default:
      return <ShoppingBag className="w-5 h-5" />
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

export default function ListingPage({ params }: { params: { id: string } }) {
  const listingId = parseInt(params.id)
  const { user } = useAuth()
  const { toast } = useToast()
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const response = await api.get(`/api/listings/${listingId}`)
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading listing...</p>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="shadow-xl">
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Listing Not Found</h2>
            <p className="text-gray-600 mb-6">The listing you're looking for doesn't exist or has been removed.</p>
            <Link href="/marketplace">
              <Button>Back to Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isOwner = user && listing.owner_id === user.id

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/marketplace">
          <Button 
            variant="ghost" 
            className="mb-6 hover:bg-blue-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <Card className="shadow-xl border-2 border-gray-200 overflow-hidden">
              <CardContent className="p-0">
                {listing.image_urls && listing.image_urls.length > 0 ? (
                  <div className="relative w-full h-96 bg-gray-100">
                    <img
                      src={listing.image_urls[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-96 bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                    <ShoppingBag className="w-32 h-32 text-white opacity-30" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="shadow-lg border-2 border-gray-200">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Description</h2>
                {listing.description ? (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {listing.description}
                  </p>
                ) : (
                  <p className="text-gray-500 italic">No description provided.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price & Info Card */}
            <Card className="shadow-xl border-2 border-gray-200 sticky top-24">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-4 line-clamp-2">
                    {listing.title}
                  </h1>
                  
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {listing.price.toLocaleString()}
                    </span>
                    <span className="text-xl text-gray-600">{listing.currency}</span>
                  </div>
                </div>

                {/* Category & Intent Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${getCategoryColor(listing.category)} flex items-center gap-2`}>
                    {getCategoryIcon(listing.category)}
                    {listing.category}
                  </span>
                  {listing.intent && (
                    <span
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        listing.intent === "SELL"
                          ? "bg-red-100 text-red-700 border-2 border-red-200"
                          : "bg-blue-100 text-blue-700 border-2 border-blue-200"
                      }`}
                    >
                      {listing.intent === "SELL" ? "For Sale" : "For Rent"}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                  {listing.compound_name && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="font-semibold">{listing.compound_name}</p>
                      </div>
                    </div>
                  )}
                  
                  {listing.owner_name && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Listed by</p>
                        <p className="font-semibold">{listing.owner_name}</p>
                      </div>
                    </div>
                  )}
                  
                  {listing.created_at && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Listed on</p>
                        <p className="font-semibold">
                          {new Date(listing.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {!isOwner && (
                    <Button 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                      size="lg"
                      onClick={() => setContactDialogOpen(true)}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Message Seller
                    </Button>
                  )}
                  
                  {isOwner && (
                    <Link href={`/promote/${listing.id}`}>
                      <Button 
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                        size="lg"
                      >
                        <TrendingUp className="w-5 h-5 mr-2" />
                        Promote Listing
                      </Button>
                    </Link>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: listing.title,
                          text: listing.description,
                          url: window.location.href,
                        }).catch(() => {
                          navigator.clipboard.writeText(window.location.href)
                          toast({
                            title: "Link copied!",
                            description: "Listing URL copied to clipboard",
                          })
                        })
                      } else {
                        navigator.clipboard.writeText(window.location.href)
                        toast({
                          title: "Link copied!",
                          description: "Listing URL copied to clipboard",
                        })
                      }
                    }}
                  >
                    <Share2 className="w-5 h-5 mr-2" />
                    Share Listing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Contact Seller Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Contact {listing.owner_name}
            </DialogTitle>
            <DialogDescription>
              Get in touch with the seller about "{listing.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {listing.owner_email && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <a 
                    href={`mailto:${listing.owner_email}?subject=Inquiry about ${encodeURIComponent(listing.title)}`}
                    className="text-blue-600 hover:text-blue-700 font-medium break-all"
                  >
                    {listing.owner_email}
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(listing.owner_email!)
                    toast({
                      title: "Email copied!",
                      description: "Email address copied to clipboard",
                    })
                  }}
                  className="h-8 w-8"
                >
                  <Mail className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {listing.owner_phone && (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <a 
                    href={`tel:${listing.owner_phone}`}
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    {listing.owner_phone}
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(listing.owner_phone!)
                    toast({
                      title: "Phone copied!",
                      description: "Phone number copied to clipboard",
                    })
                  }}
                  className="h-8 w-8"
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {!listing.owner_email && !listing.owner_phone && (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">
                  Contact information not available. Please check back later.
                </p>
              </div>
            )}
            
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 text-center">
                💡 Tip: Click on email or phone to contact directly
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setContactDialogOpen(false)}
            >
              Close
            </Button>
            {listing.owner_email && (
              <Button
                onClick={() => {
                  window.location.href = `mailto:${listing.owner_email}?subject=Inquiry about ${encodeURIComponent(listing.title)}&body=Hi ${listing.owner_name},%0D%0A%0D%0AI'm interested in your listing: ${encodeURIComponent(listing.title)}`
                  setContactDialogOpen(false)
                }}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

