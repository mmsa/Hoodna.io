'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import Link from 'next/link'

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

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const listingId = parseInt(resolvedParams.id)

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const response = await api.get(`/api/listings/${listingId}`)
      return response.data
    },
  })

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!listing) {
    return <div className="min-h-screen flex items-center justify-center">Listing not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/marketplace">
          <Button variant="ghost" className="mb-4">← Back to Marketplace</Button>
        </Link>

        <Card>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {listing.image_urls?.[0] && (
                  <img
                    src={listing.image_urls[0]}
                    alt={listing.title}
                    className="w-full rounded-lg"
                  />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{listing.title}</h1>
                <p className="text-2xl font-semibold text-primary mb-4">
                  {listing.price} {listing.currency}
                </p>
                <div className="space-y-4">
                  <div>
                    <span className="font-semibold">Category:</span> {listing.category}
                  </div>
                  <div>
                    <span className="font-semibold">Intent:</span> {listing.intent}
                  </div>
                  <div>
                    <span className="font-semibold">Location:</span> {listing.compound_name}
                  </div>
                  <div>
                    <span className="font-semibold">Owner:</span> {listing.owner_name}
                  </div>
                  {listing.description && (
                    <div>
                      <span className="font-semibold">Description:</span>
                      <p className="mt-2">{listing.description}</p>
                    </div>
                  )}
                  <Link href={`/promote/${listing.id}`}>
                    <Button className="w-full">Promote Listing</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

