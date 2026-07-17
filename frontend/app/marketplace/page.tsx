"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bookmark, Camera, Plus, ShieldAlert, ShoppingBag } from "lucide-react"

import { ListingCard } from "@/components/marketplace/listing-card"
import {
  ListingFilters,
  type ListingFilterValues,
} from "@/components/marketplace/listing-filters"
import type { ListingView } from "@/components/marketplace/listing-meta"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import { AppShell, PageLayout } from "@/components/ui/page-layout"
import { useAuth } from "@/hooks/use-auth"
import { useTranslation } from "@/components/locale-provider"
import api from "@/lib/api"
import { formatCompoundName } from "@/lib/format-compound"

const DEFAULT_FILTERS: ListingFilterValues = {
  search: "",
  category: "",
  intent: "",
  sort: "date_desc",
  minPrice: "",
  maxPrice: "",
}

export default function MarketplacePage() {
  const { user, isLoading: userLoading } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const canCreateListing = user?.can_create_listing === true

  const { data: feedSummary } = useQuery({
    queryKey: ["feed-summary", user?.compound_id],
    queryFn: async () => (await api.get("/api/feed/summary")).data,
    enabled: !!user && user.role !== "COMPOUND_MOD" && user.role !== "SERVICE_PROVIDER",
    retry: false,
  })

  const compoundName = feedSummary?.compound_name
    ? formatCompoundName(feedSummary.compound_name)
    : "your compound"

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      scope: "compound",
      sort_by: filters.sort,
    }

    if (filters.search.trim()) params.search = filters.search.trim()
    if (filters.category) params.category = filters.category
    if (filters.intent) params.intent = filters.intent
    if (filters.minPrice) params.min_price = filters.minPrice
    if (filters.maxPrice) params.max_price = filters.maxPrice

    return params
  }, [filters])

  const { data: listings, isLoading, error, refetch } = useQuery<ListingView[]>({
    queryKey: ["listings", "compound", user?.compound_id, queryParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(queryParams).toString()
      const response = await api.get(`/api/listings?${queryString}`)
      const data = response.data || []
      return data.filter((listing: ListingView) => listing.category !== "SERVICE")
    },
    enabled: !!user && user.role !== "COMPOUND_MOD" && user.role !== "SERVICE_PROVIDER",
  })

  useEffect(() => {
    if (!error) return
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status !== 403) return

    queryClient.invalidateQueries({ queryKey: ["current-user"] })
    const timeoutId = setTimeout(async () => {
      try {
        const statusResponse = await api.get("/api/verification/status")
        if (statusResponse.data.user_status === "APPROVED") {
          queryClient.invalidateQueries({ queryKey: ["current-user"] })
          queryClient.invalidateQueries({ queryKey: ["listings"] })
        } else {
          router.push("/verification")
        }
      } catch {
        router.push("/verification")
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [error, queryClient, router])

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => (key === "sort" ? value !== "date_desc" : Boolean(value))
  )

  if (userLoading || isLoading) {
    return (
      <AppShell>
        <PageLayout width="xl">
          <LoadingState title={t('marketplace.loadingMarketplace')} />
        </PageLayout>
      </AppShell>
    )
  }

  if (user?.role === "COMPOUND_MOD" || user?.role === "SERVICE_PROVIDER" || user?.status === "REJECTED") {
    const provider = user.role === "SERVICE_PROVIDER"
    const rejected = user.status === "REJECTED"
    return (
      <AppShell>
        <PageLayout width="sm">
          <ErrorState
            icon={<ShieldAlert className="h-5 w-5" />}
            title={rejected ? t('marketplace.marketplaceUnavailable') : t('marketplace.marketplaceRestricted')}
            description={
              rejected
                ? t('marketplace.accountMustBeApproved')
                : provider
                  ? t('marketplace.providerManageFromServices')
                  : t('marketplace.moderatorManageFromDashboard')
            }
            action={
              <Button asChild>
                <Link href={rejected ? "/verification" : provider ? "/services" : "/moderator/dashboard"}>
                  {t('marketplace.continue')}
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
      <PageLayout width="full" className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('marketplace.title')}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
              {t('marketplace.buySellIn', { compound: compoundName })}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('marketplace.verifiedNeighboursOnly')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/saved"><Bookmark className="h-4 w-4" />{t('marketplace.saved')}</Link>
            </Button>
            {canCreateListing ? (
              <Button asChild>
                <Link href="/marketplace/new"><Camera className="h-4 w-4" />{t('marketplace.postListing')}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <ListingFilters
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />

        {error ? (
          <ErrorState
            title={t('marketplace.couldNotLoad')}
            description={t('marketplace.checkConnection')}
            action={<Button onClick={() => refetch()}>{t('common.retry')}</Button>}
          />
        ) : listings?.length ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              {listings.length === 1
                ? t('marketplace.listingNearYou')
                : t('marketplace.listingsNearYou', { count: listings.length })}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title={hasActiveFilters ? t('marketplace.nothingMatched') : t('marketplace.nothingListedYet')}
            description={
              hasActiveFilters
                ? t('marketplace.nothingMatchedDesc')
                : t('marketplace.nothingListedDesc', { compound: compoundName })
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  {t('marketplace.clearFilters')}
                </Button>
              ) : canCreateListing ? (
                <Button asChild size="lg">
                  <Link href="/marketplace/new">
                    <Plus className="h-4 w-4" />
                    {t('marketplace.postFirstListing')}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </PageLayout>
    </AppShell>
  )
}
