'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell, PageLayout } from '@/components/ui/page-layout'
import { LoadingState } from '@/components/ui/states'

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
    <AppShell>
      <PageLayout width="sm">
        <LoadingState title="Opening listing" />
      </PageLayout>
    </AppShell>
  )
}

