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
  Heart,
  Bookmark,
  Edit,
  Trash2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Rating } from '@/components/ui/rating'
import { ReviewForm } from '@/components/review-form'
import { ReviewsList } from '@/components/reviews-list'
import { useAuth } from '@/hooks/use-auth'
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
  average_rating?: number | null
  review_count?: number
}

interface Review {
  id: number
  listing_id: number
  reviewer_id: number
  reviewer_name: string
  rating: number
  comment?: string | null
  created_at: string
  updated_at: string
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
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const response = await api.get(`/api/listings/${listingId}`)
      return response.data
    },
  })

  // Save/Unsave mutation
  const saveMutation = useMutation({
    mutationFn: async (saved: boolean) => {
      if (saved) {
        await api.delete(`/api/listings/${listingId}/save`)
      } else {
        await api.post(`/api/listings/${listingId}/save`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
      queryClient.invalidateQueries({ queryKey: ['saved-listings'] })
      toast({
        title: listing?.is_saved ? "Removed from saved" : "Saved!",
        description: listing?.is_saved 
          ? "Listing removed from your saved list" 
          : "Listing saved to your list",
        variant: "success",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update saved status",
        variant: "destructive",
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/listings/${listingId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['my-services'] })
      toast({
        title: "Listing deleted",
        description: "Your listing has been deleted successfully",
        variant: "success",
      })
      // Redirect based on user role
      if (isServiceProvider && isServiceListing) {
        router.push('/services')
      } else {
        router.push('/marketplace')
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to delete listing",
        variant: "destructive",
      })
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
  const isServiceProvider = user?.role === 'SERVICE_PROVIDER'
  const isServiceListing = listing.category === 'SERVICE'
  const backUrl = (isServiceProvider && isServiceListing) ? '/services' : '/marketplace'
  const backText = (isServiceProvider && isServiceListing) ? 'Back to My Services' : 'Back to Marketplace'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href={backUrl}>
          <Button 
            variant="ghost" 
            className="mb-6 hover:bg-blue-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backText}
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

            {/* Reviews Section - Only for Services */}
            {listing.category === 'SERVICE' && (
              <>
                {/* Review Form */}
                <ReviewForm 
                  listingId={listing.id}
                  existingReview={undefined} // TODO: Fetch user's existing review
                />

                {/* Reviews List */}
                <ReviewsList listingId={listing.id} />
              </>
            )}
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

                  {/* Rating Display */}
                  {listing.category === 'SERVICE' && listing.average_rating && (
                    <div className="mb-6">
                      <div className="flex items-center gap-3">
                        <Rating rating={listing.average_rating} size="md" showValue />
                        <span className="text-sm text-gray-600">
                          ({listing.review_count || 0} {listing.review_count === 1 ? 'review' : 'reviews'})
                        </span>
                      </div>
                    </div>
                  )}
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
                    <Link href={`/messages/new?recipient_id=${listing.owner_id}&listing_id=${listing.id}`}>
                      <Button 
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                        size="lg"
                      >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Message Seller
                      </Button>
                    </Link>
                  )}
                  
                  {isOwner && (
                    <>
                      <Link href={`/marketplace/edit/${listingId}`}>
                        <Button 
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                          size="lg"
                        >
                          <Edit className="w-5 h-5 mr-2" />
                          Edit Listing
                        </Button>
                      </Link>
                      <Button 
                        variant="destructive"
                        className="w-full"
                        size="lg"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
                            deleteMutation.mutate()
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-5 h-5 mr-2" />
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete Listing'}
                      </Button>
                    </>
                  )}
                  
                  {/* Save/Unsave Button */}
                  <Button 
                    variant={listing.is_saved ? "default" : "outline"}
                    className={`w-full ${listing.is_saved ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
                    size="lg"
                    onClick={() => saveMutation.mutate(listing.is_saved || false)}
                    disabled={saveMutation.isPending}
                  >
                    {listing.is_saved ? (
                      <>
                        <Heart className="w-5 h-5 mr-2 fill-current" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-5 h-5 mr-2" />
                        Save Listing
                      </>
                    )}
                  </Button>
                  
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
    </div>
  )
}

