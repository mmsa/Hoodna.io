'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Plus, ShieldAlert, ShoppingBag, Wrench } from 'lucide-react'

import { ListingCard } from '@/components/marketplace/listing-card'
import {
  ListingFilters,
  type ListingFilterValues,
} from '@/components/marketplace/listing-filters'
import type { ListingView } from '@/components/marketplace/listing-meta'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { AppShell, PageHeader, PageLayout } from '@/components/ui/page-layout'
import { useAuth } from '@/hooks/use-auth'
import api from '@/lib/api'
import { formatCompoundName } from '@/lib/format-compound'

const DEFAULT_FILTERS: ListingFilterValues = {
  search: '',
  category: '',
  intent: '',
  sort: 'date_desc',
  minPrice: '',
  maxPrice: '',
}

export default function MarketplacePage() {
  const { user, isLoading: userLoading } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

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
      sort_by: filters.sort,
    }
    
    if (filters.search.trim()) {
      params.search = filters.search.trim()
    }
    if (filters.category) {
      params.category = filters.category
    }
    if (filters.intent) {
      params.intent = filters.intent
    }
    if (filters.minPrice) {
      params.min_price = filters.minPrice
    }
    if (filters.maxPrice) {
      params.max_price = filters.maxPrice
    }
    
    return params
  }, [filters])

  const { data: listings, isLoading, error, refetch } = useQuery<ListingView[]>({
    queryKey: ['listings', 'compound', queryParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(queryParams).toString()
      const response = await api.get(`/api/listings?${queryString}`)
      // Filter out SERVICES - they have their own page now
      const data = response.data || []
      return data.filter((listing: ListingView) => listing.category !== 'SERVICE')
    },
    enabled: !!user && user.role !== 'COMPOUND_MOD' && user.role !== 'SERVICE_PROVIDER',
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

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => key === 'sort' ? value !== 'date_desc' : Boolean(value)
  )

  if (userLoading || isLoading) {
    return (
      <AppShell><PageLayout width="xl"><LoadingState title="Loading marketplace" /></PageLayout></AppShell>
    )
  }

  if (user?.role === 'COMPOUND_MOD' || user?.role === 'SERVICE_PROVIDER' || user?.status === 'REJECTED') {
    const provider = user.role === 'SERVICE_PROVIDER'
    const rejected = user.status === 'REJECTED'
    return (
      <AppShell>
        <PageLayout width="sm">
          <ErrorState
            icon={<ShieldAlert className="h-5 w-5" />}
            title={rejected ? 'Marketplace unavailable' : 'Marketplace access is restricted'}
            description={rejected
              ? 'Your account must be approved before you can browse or post listings.'
              : provider
                ? 'Service providers manage their listings from Services.'
                : 'Moderators manage community content from the moderation dashboard.'}
            action={
              <Button asChild>
                <Link href={rejected ? '/verification' : provider ? '/services' : '/moderator/dashboard'}>
                  Continue
                </Link>
              </Button>
            }
          />
        </PageLayout>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageLayout width="xl" className="space-y-6">
        <PageHeader
          eyebrow="Your community"
          title="Marketplace"
          description={`Buy, sell, and rent within ${compoundName}.`}
          actions={
            <>
              <Button variant="outline" asChild><Link href="/saved"><Bookmark className="h-4 w-4" />Saved</Link></Button>
              <Button variant="outline" asChild><Link href="/services"><Wrench className="h-4 w-4" />Services</Link></Button>
              <Button asChild><Link href="/marketplace/new"><Plus className="h-4 w-4" />New listing</Link></Button>
            </>
          }
        />
        <ListingFilters value={filters} onChange={setFilters} onClear={() => setFilters(DEFAULT_FILTERS)} />
        {error ? (
          <ErrorState title="Marketplace could not be loaded" description="Check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} />
        ) : listings?.length ? (
          <>
            <p className="text-sm text-muted-foreground">{listings.length} {listings.length === 1 ? 'listing' : 'listings'}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-5 w-5" />}
            title={hasActiveFilters ? 'No matching listings' : 'No listings yet'}
            description={hasActiveFilters ? 'Adjust or clear your filters to see more results.' : `Create the first listing in ${compoundName}.`}
            action={hasActiveFilters
              ? <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>
              : <Button asChild><Link href="/marketplace/new">Create a listing</Link></Button>}
          />
        )}
      </PageLayout>
    </AppShell>
  )
}
