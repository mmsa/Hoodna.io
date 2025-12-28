'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'

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

export default function MarketplacePage() {
  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ['listings', 'compound'],
    queryFn: async () => {
      const response = await api.get('/api/listings?scope=compound')
      return response.data
    },
  })

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <Link href="/marketplace/new">
            <Button>
              <ShoppingBag className="w-4 h-4 mr-2" />
              Create Listing
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {listings?.map((listing) => (
            <Link key={listing.id} href={`/listing/${listing.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-0">
                  {listing.image_urls?.[0] && (
                    <img
                      src={listing.image_urls[0]}
                      alt={listing.title}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{listing.title}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {listing.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-primary">
                        {listing.price} {listing.currency}
                      </span>
                      <span className="text-xs text-gray-500">{listing.category}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {listings?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No listings found. Be the first to create one!</p>
          </div>
        )}
      </div>
    </div>
  )
}

