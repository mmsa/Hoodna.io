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
  const queryClient = useQueryClient()
  const router = useRouter()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const { data: feedSummary } = useQuery({
    queryKey: ["feed-summary"],
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
    queryKey: ["listings", "compound", queryParams],
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
          <LoadingState title="Loading marketplace…" />
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
            title={rejected ? "Marketplace unavailable" : "Marketplace access is restricted"}
            description={
              rejected
                ? "Your account must be approved before you can browse or post listings."
                : provider
                  ? "Service providers manage their listings from Services."
                  : "Moderators manage community content from the moderation dashboard."
            }
            action={
              <Button asChild>
                <Link href={rejected ? "/verification" : provider ? "/services" : "/moderator/dashboard"}>
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
      <PageLayout width="full" className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Marketplace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
              Buy & sell in {compoundName}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Verified neighbours only — no agents, direct deals
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/saved"><Bookmark className="h-4 w-4" />Saved</Link>
            </Button>
            <Button asChild>
              <Link href="/marketplace/new"><Camera className="h-4 w-4" />Post listing</Link>
            </Button>
          </div>
        </div>

        <ListingFilters
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />

        {error ? (
          <ErrorState
            title="Couldn&apos;t load listings"
            description="Check your connection and try again."
            action={<Button onClick={() => refetch()}>Try again</Button>}
          />
        ) : listings?.length ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              {listings.length} {listings.length === 1 ? "listing" : "listings"} near you
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
            title={hasActiveFilters ? "Nothing matched" : "Nothing listed yet"}
            description={
              hasActiveFilters
                ? "Try different filters — or be the first to post something new."
                : `Snap a photo and be the first neighbour to list something in ${compoundName}.`
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/marketplace/new">
                    <Plus className="h-4 w-4" />
                    Post the first listing
                  </Link>
                </Button>
              )
            }
          />
        )}
      </PageLayout>
    </AppShell>
  )
}
