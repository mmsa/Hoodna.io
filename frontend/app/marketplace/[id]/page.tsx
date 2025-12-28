'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function MarketplaceListingRedirect() {
  const router = useRouter()
  const params = useParams()
  const listingId = params?.id

  useEffect(() => {
    if (listingId) {
      router.replace(`/listing/${listingId}`)
    }
  }, [listingId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to listing...</p>
      </div>
    </div>
  )
}

